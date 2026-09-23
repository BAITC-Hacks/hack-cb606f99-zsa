import "server-only";
import { serverEnv } from "./env";
import { JsonRepository } from "./repositories/json-repository";
import { PlatformService } from "./services/platform";
import { MockAiProvider } from "./ai/mock";
import { OpenAiProvider } from "./ai/openai";
import { AiService } from "./ai/service";

export const repository = new JsonRepository(serverEnv.DATA_FILE_PATH);
export const platform = new PlatformService(repository);
const provider = serverEnv.AI_PROVIDER === "openai"
  ? new OpenAiProvider({ apiKey: serverEnv.OPENAI_API_KEY!, model: serverEnv.OPENAI_MODEL!, timeoutMs: serverEnv.AI_TIMEOUT_MS })
  : new MockAiProvider();
export const ai = new AiService(provider, serverEnv.AI_PROVIDER, serverEnv.AI_FALLBACK_TO_MOCK);
