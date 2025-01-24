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
// @ts-ignore
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
  async onRequestStart(request) {
    const originalFetch = global.fetch;

    global.fetch = async (url, options = {}) => {
      // Ensure the headers object exists
      options.headers = options.headers || {};

      const dashboardUrl = request.params.dashboardUrl;

      // Add or override specific headers for the targeted URL
      if (url.includes("api-commerce.comercia.me") && dashboardUrl) {
        options.headers = {
          ...options.headers, // Preserve existing headers
          Origin: `https://${dashboardUrl}`,
          Referer: `https://${dashboardUrl}`,
        };
      }

      // Call the original fetch with updated options
      return originalFetch(url, options);
    };
  },
  async onRequestVerified(req, context) {
    const logger = createLogger({
      name: "onRequestVerified",
    });

    let saleorVersion: string;

    try {
      const client = createGraphQLClient({
        saleorApiUrl: process.env.NEXT_PUBLIC_SALEOR_API_URL as string || context.authData.saleorApiUrl,
        token: context.authData.token,
        dashboardUrl: req.params.dashboardUrl,
      });

      saleorVersion = await fetchSaleorVersion(client);
    } catch (e: unknown) {
      const message = (e as Error)?.message ?? "Unknown error";

      logger.debug(
        { message, saleorApiUrl: context.authData.saleorApiUrl },
        "Error during fetching saleor version in onRequestVerified handler"
      );

      throw context.respondWithError({
        message: message,
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

    try {
      await saleorApp.apl.set(context.authData);
    } catch (error) {
      console.error(`Failed to register app`, error);
    }
  },
});
