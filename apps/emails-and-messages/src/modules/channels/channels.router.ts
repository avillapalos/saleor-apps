import { createInstrumentedGraphqlClient } from "../../lib/create-instrumented-graphql-client";
import { protectedClientProcedure } from "../trpc/protected-client-procedure";
import { router } from "../trpc/trpc-server";
import { ChannelsFetcher } from "./channels-fetcher";
import {createGraphQLClient} from "@saleor/apps-shared";

export const channelsRouter = router({
  fetch: protectedClientProcedure.query(async ({ ctx }) => {
    const client = createGraphQLClient({
      saleorApiUrl: ctx.saleorApiUrl as string,
      token: ctx.token as string,
      dashboardUrl: ctx.dashboardUrl as string,
    });

    const fetcher = new ChannelsFetcher(client);

    return await fetcher.fetchChannels().then((channels) => channels ?? []);
  }),
});
