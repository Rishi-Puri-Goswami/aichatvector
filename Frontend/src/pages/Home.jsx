import React, { useCallback, useEffect, useState } from 'react';
import { io } from "socket.io-client";
import ChatMobileBar from '../components/chat/ChatMobileBar.jsx';
import ChatSidebar from '../components/chat/ChatSidebar.jsx';
import ChatMessages from '../components/chat/ChatMessages.jsx';
import ChatComposer from '../components/chat/ChatComposer.jsx';
import '../components/chat/ChatLayout.css';
import { fakeAIReply } from '../components/chat/aiClient.js';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import {
  ensureInitialChat,
  startNewChat,
  selectChat,
  setInput,
  sendingStarted,
  sendingFinished,
  addUserMessage,
  addAIMessage,
  setChats
} from '../store/chatSlice.js';

const Home = () => {
  const dispatch = useDispatch();
  const chats = useSelector(state => state.chat.chats);
  const activeChatId = useSelector(state => state.chat.activeChatId);
  const input = useSelector(state => state.chat.input);
  const isSending = useSelector(state => state.chat.isSending);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [socket, setSocket] = useState(null);

  const apikey = import.meta.env.VITE_API_URL; // ← Vite env variable

  console.log(apikey);


  const activeChat = chats.find(c => c.id === activeChatId) || null;

  const [messages, setMessages] = useState([]);

  const handleNewChat = async () => {
    let title = window.prompt('Enter a title for the new chat:', '');
    if (title) title = title.trim();
    if (!title) return;

    const response = await axios.post(`${apikey}/api/chat`, { title }, { withCredentials: true });
    getMessages(response.data.chat._id);
    dispatch(startNewChat(response.data.chat));
    setSidebarOpen(false);
  }

  useEffect(() => {
    axios.get(`${apikey}/api/chat`, { withCredentials: true })
      .then(response => {
        dispatch(setChats(response.data.chats.reverse()));
      });

    const tempSocket = io(apikey, { // ← use env variable for socket URL
      withCredentials: true,
        transports: ["websocket", "polling"],
    });

    tempSocket.on("ai-response", (messagePayload) => {
      console.log("Received AI response:", messagePayload);

      setMessages((prevMessages) => [...prevMessages, {
        type: 'ai',
        content: messagePayload.content
      }]);

      dispatch(sendingFinished());
    });

    setSocket(tempSocket);
  }, []);

  const sendMessage = async () => {
    const trimmed = input.trim();
    console.log("Sending message:", trimmed);
    if (!trimmed || !activeChatId || isSending) return;
    dispatch(sendingStarted());

    const newMessages = [...messages, { type: 'user', content: trimmed }];
    setMessages(newMessages);
    dispatch(setInput(''));

    socket.emit("ai-message", { chat: activeChatId, content: trimmed });
  }

  const getMessages = async (chatId) => {
    const response = await axios.get(`${apikey}/api/chat/messages/${chatId}`, { withCredentials: true });

    console.log("Fetched messages:", response.data.messages);

    setMessages(response.data.messages.map(m => ({
      type: m.role === 'user' ? 'user' : 'ai',
      content: m.content
    })));
  }

  return (
    <div className="chat-layout minimal">
      <ChatMobileBar
        onToggleSidebar={() => setSidebarOpen(o => !o)}
        onNewChat={handleNewChat}
      />
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={(id) => {
          dispatch(selectChat(id));
          setSidebarOpen(false);
          getMessages(id);
        }}
        onNewChat={handleNewChat}
        open={sidebarOpen}
      />
      <main className="chat-main" role="main">
        {messages.length === 0 && (
          <div className="chat-welcome" aria-hidden="true">
            <div className="chip">Early Preview</div>
            <h1>Mini-RAG AI Assistant</h1>
<p>Paste your text in the box below and ask questions to get answers grounded in your content.  
The assistant retrieves relevant information, reranks it, and generates responses with citations.</p>
          </div>
        )}
        <ChatMessages messages={messages} isSending={isSending} />
        {activeChatId &&
          <ChatComposer
            input={input}
            setInput={(v) => dispatch(setInput(v))}
            onSend={sendMessage}
            isSending={isSending}
          />}
      </main>
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Home;
