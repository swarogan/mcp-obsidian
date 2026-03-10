#!/usr/bin/env node

import { createMcpServer } from "./runtime/mcp-server.js";
import { startStdioServer } from "./runtime/stdio.js";

startStdioServer(createMcpServer());