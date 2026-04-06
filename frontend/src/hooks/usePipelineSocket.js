import { useEffect } from "react";
import { getPipelineWebSocketUrl } from "../services/api.js";

export const usePipelineSocket = (token, onPipelineUpdate) => {
  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const socket = new WebSocket(getPipelineWebSocketUrl(token));

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "pipeline.updated") {
        onPipelineUpdate(message.payload);
      }
    };

    return () => {
      socket.close();
    };
  }, [onPipelineUpdate, token]);
};

