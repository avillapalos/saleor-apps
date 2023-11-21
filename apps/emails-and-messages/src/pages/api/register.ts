import { createAppRegisterHandler } from "@saleor/app-sdk/handlers/next";

import { REQUIRED_SALEOR_VERSION, saleorApp } from "../../saleor-app";
import {
  SaleorVersionCompatibilityValidator,
  createGraphQLClient,
  createLogger,
} from "@saleor/apps-shared";
import { fetchSaleorVersion } from "../../modules/feature-flag-service/fetch-saleor-version";

const allowedUrlsPattern = process.env.ALLOWED_DOMAIN_PATTERN;

/**
 * Required endpoint, called by Saleor to install app.
 * It will exchange tokens with app, so saleorApp.apl will contain token
 */
export default createAppRegisterHandler({
  apl: saleorApp.apl,
  allowedSaleorUrls: [
    (url) => {
      if (allowedUrlsPattern) {
        const regex = new RegExp(allowedUrlsPattern);

        return regex.test(url);
      }

      return true;
    },
  ],
  async onRequestVerified(req, context) {
    const logger = createLogger({
      name: "onRequestVerified",
    });

    let saleorVersion: string;

    try {
      const client = createGraphQLClient({
        // eslint-disable-next-line turbo/no-undeclared-env-vars
        saleorApiUrl: process.env.NEXT_PUBLIC_SALEOR_API_URL || context.authData.saleorApiUrl,
        token: context.authData.token,
      });

      saleorVersion = await fetchSaleorVersion(client);
    } catch (e: unknown) {
      const message = (e as Error)?.message ?? "Unknown error";

      logger.debug(
        { message, saleorApiUrl: context.authData.saleorApiUrl },
        "Error during fetching saleor version in onRequestVerified handler"
      );

      throw context.respondWithError({
        message: "Couldn't communicate with Saleor API",
        status: 400,
      });
    }

    if (!saleorVersion) {
      logger.warn({ saleorApiUrl: context.authData.saleorApiUrl }, "No version returned from Saleor API");
      throw context.respondWithError({
        message: "Saleor version couldn't be fetched from the API",
        status: 400,
      });
    }

    const isVersionValid = new SaleorVersionCompatibilityValidator(REQUIRED_SALEOR_VERSION).isValid(
      saleorVersion
    );

    if (!isVersionValid) {
      logger.info({ saleorApiUrl: context.authData.saleorApiUrl }, "Rejecting installation due to incompatible Saleor version");
      throw context.respondWithError({
        message: `Saleor version (${saleorVersion}) is not compatible with this app version (${REQUIRED_SALEOR_VERSION})`,
        status: 400,
      });
    }

    logger.info("Saleor version validated successfully");

    // context.authData.saleorApiUrl = context.authData.saleorApiUrl + "?app=emails-and-messages";

    try {
      await saleorApp.apl.set(context.authData);
    } catch (error) {
      console.error(`Failed to register app`, error);
    }
  },
});
