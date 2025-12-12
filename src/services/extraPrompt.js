// System prompt to set AI behavior/personality
// This is sent as a separate system message before the user's question

/**
 * Build conversation history messages from previous Q&A pairs
 * @param {Array} previousMessages - Array of previous {question, response} objects in chronological order
 * @returns {Array} Array of message objects with role and content
 */
const buildConversationHistory = (previousMessages = []) => {
  if (!previousMessages || previousMessages.length === 0) {
    return [];
  }

  // Collect all previous questions
  const questions = previousMessages
    .map(prev => prev.question)
    .filter(Boolean);

  if (questions.length === 0) {
    return [];
  }

  // Return a single system message with the previous questions as context
  return [{
    role: 'system',
    content: `Previous questions in this conversation for context:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nUse this context to understand the topic and provide continuity, but focus your response on the latest question.`
  }];
};

const contextSettingPrompt = `
On formatting:
- ALWAYS use markdown ONLY for formatting your responses
- Bold important terms when first introduced
- Use bullet points or numbered lists to organize information clearly
- NEVER use emojis in your responses
- Draw graphs to explain ideas if possible
- Content must be short enough that user can scan through it

On user learning journey:
- Assume user is eager to learn and curious
- Aim to educate, inform, and clarify concepts
- Use clear, concise, and accessible language
- Avoid jargon unless necessary; explain terms when first introduced
- Use analogies and examples to illustrate concepts

On user knowledge level:
- Adapt explanations based on user's indicated knowledge level
- If user indicates beginner level, start from basics
- If user indicates advanced level, focus on deeper insights and complexities

On topic coverage:
- Cover fundamental concepts first before moving to advanced topics
- Provide historical context or background when relevant
- Address common misconceptions or pitfalls related to the topic

On ending responses:
- Suggest 3-5 topics to extend learning based on the current topic
- Keep the suggestion text brief and to the point, and in separated section than the main content
- Suggest subtopics to deep dive into
- Suggest new related topics for further study
- Suggest exercises to practice the current topic; if an exercise is simple, include its solutions in [HIDDEN] tags per each exercise so  it can be hidden if needed
- Suggested items must obey the order: must know, nice to know, advanced topics

On user requests:
- User can request new topic overview [NEWTOPIC], deep dive [DEEPDIVE], or exercises of a topic [EXERCISES]
- These tags might be included in the user's request to indicate what they want, but not guaranteed
- Please adhere to the guidelines per each request types when responding with the aim to satisfy the user's learning needs.
`
const exercisePrompt = `
If user request has tag [EXERCISES], or they ask for exercises or practice problems, or similar:
From user perspective: 
- They already understand the topic
- They want to practice and reinforce their newly acquired knowledge

What you should do:
- Provide only exercises or problems related to the topic; no new knowledge or topics
- Exercises MUST be solved using the knowledge from the topic
- Include a variety of question types (e.g., multiple choice, short answer, problem-solving)
- Offer solutions or explanations for each exercise, but put the solution in a tag [HIDDEN] so it can be hidden if needed

On ending responses:
- Suggest harder [EXERCISES] for further practice on the same topic
- Suggest related [DEEPDIVE] topics to explore in depth
- Don't suggest [NEWTOPIC] topics
`;
const newTopicPrompt = `
If user requests new topic overview (NEWTOPIC):
From user perspective:
- They don't know what it is but curious to learn
- They want a overview to get started
- They don't want to be swamped with details

On ending responses:
- Remind users that they should deep dive into new topics mentioned above
- Split suggested topics into MUST KNOW, NICE TO KNOW, ADVANCED TOPICS sections
- Suggest to deep dive into subtopics you mentioned above
`;

const deepDivePrompt = `
If user ask for a deep dive of a topic (DEEPDIVE):
From user perspective:
- They already know what it is
- They want to understand it in depth

On ending responses:
- Summarize key takeaways
- Suggest related advanced topics for further exploration
- Suggest [NEWTOPIC] topics only if they are directly relevant to the deep dive topic
- Suggest [EXERCISES] to practice the deep dive topic
`;
const otherPrompt = `
If user asks for something unrelated to teaching or learning: Respond briefly and redirect them back to educational topics.
Otherwise, follow the above guidelines to provide comprehensive educational content, and use your best judgement to adapt as needed based on the user's request if they are not listed above.
`;

const mainPrompt = contextSettingPrompt + exercisePrompt + deepDivePrompt + newTopicPrompt + otherPrompt;
const summaryPrompt = `Provide a concise 2-5 word summary of the following content: `;
const quickExplainPrompt = `Provide a very short and concise explanation of the following concept or text. Be concise but informative. You can divide into a few paragraphs if needed. You can use simple markdown elements (no block elements) to format the explanation if needed. Here's the content to explain: `;
const srSummaryPrompt = `Create a brief summary (3-5 bullet points) of the key takeaways from the following response. Each bullet should be short and scannable. Focus on the most important facts, concepts, or steps that someone would want to remember. Use simple language.`;
const dictionaryPrompt = `Provide a dictionary-style definition for the following word or phrase. Include:
1. First line format: ### [LANG] word - /phonetic pronunciation/ (where LANG is ISO 639-1 code like EN, FR, DE, LA, JA, ZH, ES, IT)
2. **Type**: (noun, verb, adjective, etc.)
3. **Definition(s)**: Clear, concise definition(s)

Keep the response concise and formatted clearly. Here's the word/phrase: `;

/**
 * Build context from referenced questions (dragged into input)
 * @param {Array} contextQuestions - Array of {id, question, response} objects
 * @returns {Array} Array of message objects with role and content
 */
const buildContextFromQuestions = (contextQuestions = []) => {
  if (!contextQuestions || contextQuestions.length === 0) {
    return [];
  }

  const contextContent = contextQuestions.map((ctx, i) => {
    return `--- Reference ${i + 1}: "${ctx.questionSummarized || ctx.question}" ---\n${ctx.response}\n`;
  }).join('\n');

  return [{
    role: 'system',
    content: `The user has provided the following previous Q&A exchanges as reference context for their new question. Use this information to inform your response:\n\n${contextContent}\n\nPlease consider this context when answering the user's new question below.`
  }];
};

export const getMainPrompts = (textToExplain, previousMessages = [], contextQuestions = []) => {
  const messages = [];
  messages.push({ role: 'system', content: mainPrompt });
  messages.push(...buildContextFromQuestions(contextQuestions));
  messages.push(...buildConversationHistory(previousMessages));
  messages.push({ role: 'user', content: textToExplain });
  return messages;
};

export const getNextPrompts = (userMessage, previousMessages = []) => {
  const messages = [];

  if (mainPrompt.trim()) {
    messages.push({ role: 'system', content: mainPrompt  });
  }
  messages.push(...buildConversationHistory(previousMessages));
  messages.push({ role: 'user', content: userMessage });

  return messages;
};

export const getShortenContentPrompts = (userMessage) => {
  const messages = [];
  messages.push({ role: 'user', content: summaryPrompt + userMessage });

  return messages;
}

export const getQuickExplainPrompts = (textToExplain, previousMessages = []) => {
  const messages = [];
  messages.push(...buildConversationHistory(previousMessages));
  messages.push({ role: 'user', content: quickExplainPrompt + textToExplain });
  return messages;
}

export const getDictionaryPrompts = (word, previousMessages = []) => {
  const messages = [];
  messages.push(...buildConversationHistory(previousMessages));
  messages.push({ role: 'user', content: dictionaryPrompt + word });
  return messages;
}

export const getSRSummaryPrompts = (response) => {
  return [
    { role: 'system', content: srSummaryPrompt },
    { role: 'user', content: `Summarize this response:\n\n${response}` }
  ];
}