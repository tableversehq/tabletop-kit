import { useTTKitContext } from "../client/context.tsx";

export function useViewerId(): string {
  return useTTKitContext().client.viewerId;
}
