import type { NextApiRequest, NextApiResponse } from 'next';
import { MetadataMode } from 'llamaindex';
import { getDataSource } from '../engine';
import { extractText } from '@llamaindex/core/utils';
import {
  PromptTemplate,
  type ContextSystemPrompt,
} from '@llamaindex/core/prompts';
import { createMessageContent } from '@llamaindex/core/response-synthesizers';
import { initSettings } from '../engine/settings';

type ResponseData = {
  message: string;
};

initSettings();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
) {
  try {
    const { query } = req.query;
    if (typeof query !== 'string' || query.trim() === '') {
      console.log('[context] Invalid query parameter');
      return res.status(400).json({
        message: "A valid 'query' string parameter is required in the URL",
      });
    }

    console.log(`[context] Processing query: "${query}"`);

    const index = await getDataSource();
    if (!index) {
      throw new Error(
        `StorageContext is empty - call 'npm run generate' to generate the storage first`,
      );
    }
    const retriever = index.asRetriever();

    const nodes = await retriever.retrieve({
      query: query,
    });
    console.log(`[context] Retrieved ${nodes.length} nodes`);

    const contextSystemPrompt: ContextSystemPrompt = new PromptTemplate({
      templateVars: ['context'],
      template: `For improving the answer to my last question use the following context:
---------------------
{context}
---------------------`,
    });

    const content = await createMessageContent(
      contextSystemPrompt as any,
      nodes.map((r) => r.node),
      undefined,
      MetadataMode.LLM,
    );

    res.status(200).json({ message: extractText(content) });
  } catch (error) {
    console.error('[context] Error:', error);
    return res.status(500).json({
      message: (error as Error).message,
    });
  }
}
