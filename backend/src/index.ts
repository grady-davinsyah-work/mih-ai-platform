import { config } from "./config";
import { createApp } from "./app";

const app = createApp();
app.listen(config.port, () => console.log(`backend listening on :${config.port}`));
