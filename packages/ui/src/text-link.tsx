import { actions } from "@saleor/app-sdk/app-bridge";
import { Text, TextProps } from "@saleor/macaw-ui/next";
import { useRouter } from "next/router";
import { appBridgeInstance } from "../../../apps/emails-and-messages/src/pages/_app";

export interface TextLinkProps extends TextProps {
  href: string;
  newTab?: boolean;
}

const BaseTextLink = (props: TextLinkProps) => {
  return (
    <Text target="_blank" as={"a"} textDecoration={"none"} rel="noopener noreferrer" {...props}>
      <Text
        transition={"ease"}
        variant={"bodyStrong"}
        size={props.size}
        color={{
          default: "text3Decorative",
          hover: "text1Decorative",
        }}
      >
        {props.children}
      </Text>
    </Text>
  );
};

export const TextLink = ({ href, newTab = false, children, ...props }: TextLinkProps) => {
  const { push } = useRouter();

  const onNewTabClick = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    event.preventDefault();

    if (!appBridgeInstance) {
      console.warn(
        "App bridge is not initialized, TextLink cannot be used with external links without it."
      );
    }

    appBridgeInstance?.dispatch(
      actions.Redirect({
        to: href,
        newContext: true,
      })
    );

    if (props.onClick) {
      props.onClick(event);
    }
  };

  const onInternalClick = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    event.preventDefault();

    push(href);

    if (props.onClick) {
      props.onClick(event);
    }
  };

  if (newTab) {
    return (
      <BaseTextLink href={href} onClick={onNewTabClick} {...props}>
        {children}
      </BaseTextLink>
    );
  } else {
    return (
      <BaseTextLink href={href} onClick={onInternalClick} {...props}>
        {children}
      </BaseTextLink>
    );
  }
};
