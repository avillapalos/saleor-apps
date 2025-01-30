import { OrderDetailsFragmentDoc } from "./../../../../generated/graphql";
import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import { gql } from "urql";
import { saleorApp } from "../../../saleor-app";
import { createLogger, createGraphQLClient } from "@saleor/apps-shared";
import { OrderCreatedWebhookPayloadFragment } from "../../../../generated/graphql";
import { sendEventMessages } from "../../../modules/event-handlers/send-event-messages";

const OrderCreatedWebhookPayload = gql`
  ${OrderDetailsFragmentDoc}
  fragment OrderCreatedWebhookPayload on OrderCreated {
    order {
      ...OrderDetails
    }
  }
`;

const OrderCreatedGraphqlSubscription = gql`
  ${OrderCreatedWebhookPayload}
  subscription OrderCreated {
    event {
      ...OrderCreatedWebhookPayload
    }
  }
`;

export const orderCreatedWebhook = new SaleorAsyncWebhook<OrderCreatedWebhookPayloadFragment>({
  name: "Order Created in Saleor",
  webhookPath: "api/webhooks/order-created",
  asyncEvent: "ORDER_CREATED",
  apl: saleorApp.apl,
  subscriptionQueryAst: OrderCreatedGraphqlSubscription,
});

const logger = createLogger({
  name: orderCreatedWebhook.webhookPath,
});

export default async function (req, res) {
  try {
    // ✅ Read request body manually (Saleor expects raw body)
    const rawBody = await new Promise((resolve, reject) => {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => resolve(body));
      req.on("error", reject);
    });

    // ✅ Parse body safely
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      logger.error("🚨 Error parsing JSON:", error);
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    // ✅ Get Saleor authentication data (replacing missing context)
    const authData = await saleorApp.apl.get(req?.query?.appId || "");

    if (!authData) {
      logger.error("🚨 Failed to fetch Saleor auth data");
      return res.status(401).json({ error: "Unauthorized: Missing auth data" });
    }

    logger.log("🔹 Extracted Saleor Auth Data:", authData);

    // ✅ Extract order details
    const { order } = payload;
    if (!order) {
      logger.error("🚨 No order data received");
      return res.status(400).json({ error: "Missing order data" });
    }

    // ✅ Custom logic (e.g., sending emails)
    const recipientEmail = order.userEmail || order.user?.email;
    if (!recipientEmail) {
      logger.error("🚨 Order has no email recipient");
      return res.status(400).json({ error: "Order has no recipient email" });
    }

    const channel = order.channel.slug ?? "shop";
    const client = createGraphQLClient({
      saleorApiUrl: authData.saleorApiUrl,
      token: authData.token,
      dashboardUrl: authData.dashboardUrl,
    });

    // (Optional) Example of sending event messages
    await sendEventMessages({
      authData,
      channel,
      client,
      event: "ORDER_CREATED",
      payload: { order },
      recipientEmail,
    });

    return res.status(200).json({ message: "Webhook processed" });

  } catch (error) {
    logger.error("🚨 UNHANDLED ERROR:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
