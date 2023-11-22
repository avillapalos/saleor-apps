import { NextWebhookApiHandler, SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import { gql } from "urql";

import { CheckoutCreatedWebhookPayloadFragment } from "../../../../generated/graphql";
import { createSettingsManager } from "../../../lib/metadata";
import { saleorApp } from "../../../lib/saleor-app";
import { sendCheckoutSlackMessage } from "../../../lib/slack";
import { createGraphQLClient } from "@saleor/apps-shared";

const CheckoutCreatedWebhookPayload = gql`
  fragment CheckoutCreatedWebhookPayload on CheckoutCreated {
    checkout {
      id
      created
      email
      voucherCode
      totalPrice {
        currency
        gross {
          amount
        }
      }
      lines {
        quantity
        unitPrice {
          currency
          gross {
            amount
          }
        }
        variant {
          id
          name
          product {
            id
            name
          }
        }
      }
    }
  }
`;

const CheckoutCreatedGraphqlSubscription = gql`
  ${CheckoutCreatedWebhookPayload}
  subscription CheckoutCreated {
    event {
      ...CheckoutCreatedWebhookPayload
    }
  }
`;

export const checkoutCreatedWebhook = new SaleorAsyncWebhook<CheckoutCreatedWebhookPayloadFragment>(
  {
    name: "Checkout Created in Saleor",
    webhookPath: "api/webhooks/checkout-created",
    event: "CHECKOUT_CREATED",
    apl: saleorApp.apl,
    query: CheckoutCreatedGraphqlSubscription,
  },
);

const handler: NextWebhookApiHandler<CheckoutCreatedWebhookPayloadFragment> = async (
  req,
  res,
  context,
) => {
  const { payload, authData } = context;

  const { saleorApiUrl, token, appId } = authData;

  const client = createGraphQLClient({
    saleorApiUrl,
    token,
  });

  const settings = createSettingsManager(client, appId);

  const webhookUrl = await settings.get("WEBHOOK_URL");

  if (!webhookUrl) {
    return res.status(400).send({
      success: false,
      message:
        "The application has not been configured yet - Missing webhook URL configuration value",
    });
  }

  if (!payload.checkout) {
    return res
      .status(400)
      .send({ success: false, message: "Checkout not found in request payload" });
  }

  const response = await sendCheckoutSlackMessage(webhookUrl, {
    saleorApiUrl,
    checkout: payload.checkout,
  });

  if (response.status !== 200) {
    const errorMessage = await response.text();

    console.error(`Slack API responded with code ${response.status}: ${errorMessage}`);

    return res.status(500).send({
      success: false,
      message: `Slack API responded with status ${response.status}. Message: ${errorMessage}`,
    });
  }

  return res.status(200).send({ success: true, message: "Slack message sent!" });
};

export default checkoutCreatedWebhook.createHandler(handler);

export const config = {
  api: {
    bodyParser: false,
  },
};
