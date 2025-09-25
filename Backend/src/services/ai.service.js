// backend/services/ai.service.js
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY
});

// -------------------------
// Generate AI response based on retrieved content + chat history
async function generateResponse(messages) {
    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: messages,
        config: {
            temperature: 0.7,
            systemInstruction: `
<persona>
    <name>Aurora</name>
    <mission>Answer only based on provided content. Never guess.</mission>
</persona>
<behavior>
    <tone>Supportive, concise, professional.</tone>
    <interaction>If context missing, reply: "I’m sorry, I cannot answer this question as the necessary information is not available in the provided content."</interaction>
</behavior>
<capabilities>
    <structure>
        1) Begin with clear answer.
        2) Include reasoning/examples strictly from content.
        3) End with note if more context required.
    </structure>
    <code>Minimal code examples only if relevant.</code>
</capabilities>
<constraints>
    <refusal>No relevant context: "I’m sorry, I cannot answer this question as the necessary information is not available in the provided content."</refusal>
    <accuracy>Never invent facts, stick to given content.</accuracy>
</constraints>
`
        }
    });

    return response.text;
}

// Generate embedding vector for text
async function generateVector(content) {
    const response = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: content,
        config: { outputDimensionality: 768 }
    });

    return response.embeddings[0].values;
}

module.exports = {
    generateResponse,
    generateVector
};



