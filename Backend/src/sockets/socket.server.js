// backend/sockets/socket.server.js
const { Server } = require("socket.io");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const userModel = require("../models/user.model");
const messageModel = require("../models/message.model");
const { generateVector, generateResponse } = require("../services/ai.service");
const { createMemory, queryMemory } = require("../services/vector.service");


function chunkText(text, size = 800, overlap = 0.15) {
    const chunks = [];
    const step = Math.floor(size * (1 - overlap));
    for (let i = 0; i < text.length; i += step) {
        const chunk = text.slice(i, i + size).trim();
        if (chunk) chunks.push({ text: chunk, position: i });
    }
    return chunks;
}

function initSocketServer(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: "http://localhost:5173",
            allowedHeaders: ["Content-Type", "Authorization"],
            credentials: true,
        },
    });

    io.use(async (socket, next) => {
        const cookies = cookie.parse(socket.handshake.headers?.cookie || "");
        if (!cookies.token) return next(new Error("Authentication error: No token provided"));
        try {
            const decoded = jwt.verify(cookies.token, process.env.JWT_SECRET);
            const user = await userModel.findById(decoded.id);
            socket.user = user;
            next();
        } catch (err) {
            next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        console.log("User connected:", socket.user._id);

        socket.on("ai-message", async ({ chat: chatId, content }) => {
            try {
                if (!content || content.trim().length === 0) {
                    socket.emit("ai-response", { content: "Cannot process empty message.", chat: chatId });
                    return;
                }

             

                const chunks = chunkText(content, 800, 0.15);


                for (let idx = 0; idx < chunks.length; idx++) {
                    const chunk = chunks[idx];
                    const vector = await generateVector(chunk.text);
                    await createMemory({
                        vectors: vector,
                        messageId: `${chatId}-${Date.now()}-${idx}`,
                        metadata: {
                            chat: chatId,
                            user: socket.user._id,
                            text: chunk.text,
                            source: `User input`,
                            position: chunk.position
                        }
                    });
                }

               
                await messageModel.create({
                    chat: chatId,
                    user: socket.user._id,
                    content,
                    role: "user"
                });

               
                const queryVector = await generateVector(content);
                let memory = await queryMemory({
                    queryVector,
                    limit: 5,
                    metadata: { user: socket.user._id }
                });

          
                if (!memory || memory.length === 0) {
                    const msg = "I’m sorry, I cannot answer this question as the necessary information is not available in the provided content.";
                    socket.emit("ai-response", { content: msg, chat: chatId });
                    return;
                }

               

                const contextText = memory
                    .map((m, i) => `[${i + 1}] ${m.metadata.text}`)
                    .join("\n");

                const ltm = [
                    {
                        role: "user",
                        parts: [{
                            text: `Use the following relevant content with inline citations:\n${contextText}`
                        }]
                    }
                ];

                
                const chatHistory = await messageModel.find({ chat: chatId })
                    .sort({ createdAt: -1 })
                    .limit(20)
                    .lean()
                    .then(msgs => msgs.reverse());

                const stm = chatHistory.map(item => ({
                    role: item.role,
                    parts: [{ text: item.content }]
                }));

               

                const response = await generateResponse([...ltm, ...stm]);

                
                socket.emit("ai-response", { content: response, chat: chatId });

                
                const responseVector = await generateVector(response);
                await createMemory({
                    vectors: responseVector,
                    messageId: `${chatId}-${Date.now()}-resp`,
                    metadata: {
                        chat: chatId,
                        user: socket.user._id,
                        text: response,
                        source: "AI Response"
                    }
                });

                await messageModel.create({
                    chat: chatId,
                    user: socket.user._id,
                    content: response,
                    role: "model"
                });

            } catch (err) {
                console.error("Error handling ai-message:", err);
                socket.emit("ai-response", {
                    content: "An error occurred while processing your message.",
                    chat: chatId,
                });
            }
        });

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.user._id);
        });
    });
}

module.exports = initSocketServer;
