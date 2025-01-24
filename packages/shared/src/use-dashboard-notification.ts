import { useCallback } from "react";
import { actions, useAppBridge } from "@saleor/app-sdk/app-bridge";
import { appBridgeInstance } from "../../../apps/emails-and-messages/src/pages/_app";


export const useDashboardNotification = () => {
  return {
    notifySuccess: useCallback(
      (title: string, text?: string) => {
        appBridgeInstance?.dispatch(
          actions.Notification({
            status: "success",
            title,
            text,
          })
        );
      },
      [appBridgeInstance]
    ),
    notifyError: useCallback(
      (title: string, text?: string, apiMessage?: string) => {
        appBridgeInstance?.dispatch(
          actions.Notification({
            status: "error",
            title,
            text,
            apiMessage: apiMessage,
          })
        );
      },
      [appBridgeInstance]
    ),
    notifyWarning: useCallback(
      (title: string, text?: string) => {
        appBridgeInstance?.dispatch(
          actions.Notification({
            status: "warning",
            title,
            text,
          })
        );
      },
      [appBridgeInstance]
    ),
    notifyInfo: useCallback(
      (title: string, text?: string) => {
        appBridgeInstance?.dispatch(
          actions.Notification({
            status: "info",
            title,
            text,
          })
        );
      },
      [appBridgeInstance]
    ),
  };
};
