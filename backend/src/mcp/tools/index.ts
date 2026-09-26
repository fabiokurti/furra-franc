import { McpTool } from '../lib';
import { salesTools } from './sales';
import { productTools } from './products';
import { deliveryTools } from './deliveries';
import { clientTools } from './clients';
import { paymentTools } from './payments';
import { stockTools } from './stock';
import { returnTools } from './returns';
import { summaryTools } from './summary';

/** All read-only MCP tools exposed to ChatGPT (Phase 1). */
export const allTools: McpTool[] = [
  ...productTools,
  ...salesTools,
  ...deliveryTools,
  ...clientTools,
  ...paymentTools,
  ...stockTools,
  ...returnTools,
  ...summaryTools,
];
