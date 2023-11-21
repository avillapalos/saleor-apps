import { createAppRegisterHandler } from "@saleor/app-sdk/handlers/next";

import { allowedUrlsPattern, saleorApp } from "../../lib/saleor-app";

const handler = createAppRegisterHandler({
  apl: saleorApp.apl,
  allowedSaleorUrls: [
    (url) => {
      if (allowedUrlsPattern) {
        const regex = new RegExp(allowedUrlsPattern);

        if (regex.test(url)) {
          console.debug(`Registration from the URL ${url} has been accepted`);
          return true;
        }
        console.debug(
          `Registration from the URL ${url} has been rejected, since it's not meet the regex pattern ${allowedUrlsPattern}`
        );
        return false;
      }

      return true;
    },
  ],
  onRequestVerified: async (request, context) => {
    context.authData.saleorApiUrl = context.authData.saleorApiUrl + "?app=slack";

    try {
      await saleorApp.apl.set(context.authData);
    } catch (error) {
      console.error(`Failed to register app`, error);
    }
  },
});

export default handler;
