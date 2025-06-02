import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowBigLeftDash, MessageCircle, MousePointer2 } from 'lucide-react';
import axios from 'axios';
import io from 'socket.io-client';
import { debounce } from 'lodash';
import { useAuth } from './context/AuthContext';
import { jwtDecode } from 'jwt-decode';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Messages = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [userName, setUserName] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [hasSentAutoHi, setHasSentAutoHi] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [lastMessageTimes, setLastMessageTimes] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const isFetchingMessagesRef = useRef(false);
  const isFetchingUnreadCountsRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const navigate = useNavigate();
  const { auth, logout } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const cache = useRef({
    users: null,
    messages: {},
  });

  const BASE_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
  const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

  const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

  const getUserId = useCallback(() => {
    if (!auth.token) {
      toast.error('Please log in to view messages.');
      navigate('/login');
      return null;
    }
    try {
      const decoded = jwtDecode(auth.token);
      if (decoded.expiresAt < Date.now()) {
        toast.error('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return null;
      }
      return decoded.id;
    } catch (err) {
      console.error('Failed to decode token:', err);
      toast.error('Invalid token. Please log in again.');
      logout();
      navigate('/login');
      return null;
    }
  }, [auth.token, logout, navigate]);

  const getInitials = (name) => {
    if (!name) return '';
    return name
      .split(' ')
      .map((word) => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const updateFavicon = useCallback((hasUnread) => {
    const favicon = document.querySelector("link[rel*='icon']") || document.createElement('link');
    favicon.rel = 'icon';
    favicon.href = hasUnread ? '/favicon-unread.ico' : '/favicon.ico';
    document.head.appendChild(favicon);
  }, []);

  const isNearBottom = useCallback(() => {
    if (!scrollContainerRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNear = scrollTop + clientHeight >= scrollHeight - 50;
    console.log('isNearBottom:', isNear, { scrollTop, scrollHeight, clientHeight });
    return isNear;
  }, []);

  const scrollToBottom = useCallback((immediate = false) => {
    if (!scrollContainerRef.current || !isNearBottomRef.current) return;
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        const scrollHeight = scrollContainerRef.current.scrollHeight;
        scrollContainerRef.current.scrollTo({
          top: scrollHeight,
          behavior: immediate ? 'auto' : 'smooth',
        });
        console.log('Scrolled to bottom, scrollHeight:', scrollHeight);
      }
    });
  }, []);

  // Consolidated scroll handling
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      isNearBottomRef.current = isNearBottom();
    };

    const debouncedResize = debounce(() => {
      if (isNearBottomRef.current) scrollToBottom(true);
    }, 100);

    const observer = new ResizeObserver(debouncedResize);
    observer.observe(scrollContainer);
    scrollContainer.addEventListener('scroll', handleScroll);

    // Initial scroll to bottom
    scrollToBottom(true);

    return () => {
      observer.unobserve(scrollContainer);
      scrollContainer.removeEventListener('scroll', handleScroll);
      debouncedResize.cancel();
    };
  }, [isNearBottom, scrollToBottom]);

  // Scroll only for new messages or typing
  useEffect(() => {
    if (messages.length > 0 || isTyping) {
      scrollToBottom(true);
    }
  }, [messages.length, isTyping, scrollToBottom]);

  const fetchUnreadCounts = useCallback(
    async (retryCount = 0) => {
      const userId = getUserId();
      if (isFetchingUnreadCountsRef.current || !userId) return;
      isFetchingUnreadCountsRef.current = true;

      try {
        const res = await axios.get(`${BASE_URL}/api/messages/unread-counts`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        const counts = {};
        res.data.data.forEach(({ userId, count }) => {
          counts[userId] = count;
        });
        setUnreadCounts(counts);
        updateFavicon(Object.values(counts).some((count) => count > 0));
      } catch (err) {
        console.error('Error fetching unread counts:', err.response?.data || err.message);
        if (err.response?.status === 401 || err.response?.status === 400) {
          toast.error('Session expired. Please log in again.');
          logout();
          navigate('/login');
        } else if (retryCount < 3) {
          setTimeout(() => fetchUnreadCounts(retryCount + 1), 2000);
        } else {
          toast.error('Unable to fetch unread messages. Please try again later.');
        }
      } finally {
        isFetchingUnreadCountsRef.current = false;
      }
    },
    [auth.token, getUserId, logout, navigate, updateFavicon]
  );

  const fetchUsers = useCallback(
    async () => {
      const userId = getUserId();
      if (!userId) return;
      setIsLoadingUsers(true);

      if (cache.current.users) {
        const others = cache.current.users.filter((u) => u._id !== userId);
        setUsers(others);
        setFilteredUsers(others);
        await fetchUnreadCounts();
        setIsLoadingUsers(false);
        return;
      }

      try {
        const res = await axios.get(`${BASE_URL}/api/users`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        const usersList = res.data.data?.users ?? [];
        cache.current.users = usersList;
        const others = usersList.filter((u) => u._id !== userId);
        setUsers(others);
        setFilteredUsers(others);

        const times = {};
        for (const user of others) {
          if (!isValidObjectId(user._id)) continue;
          try {
            const msgRes = await axios.get(`${BASE_URL}/api/messages/${user._id}?page=1&limit=1`, {
              headers: { Authorization: `Bearer ${auth.token}` },
            });
            if (msgRes.data.data.messages.length > 0) {
              times[user._id] = new Date(msgRes.data.data.messages[0].createdAt).getTime();
            }
          } catch (err) {
            console.error(`Error fetching recent message for ${user._id}:`, err);
          }
        }
        setLastMessageTimes(times);
        await fetchUnreadCounts();
      } catch (err) {
        console.error('Error fetching users:', err.response?.data || err.message);
        if (err.response?.status === 401 || err.response?.data?.error?.name === 'TokenExpiredError') {
          toast.error('Session expired. Please log in again.');
          logout();
          navigate('/login');
        } else {
          toast.error('Failed to load users. Please try again.');
        }
      } finally {
        setIsLoadingUsers(false);
      }
    },
    [auth.token, getUserId, logout, navigate, fetchUnreadCounts]
  );

  const fetchMessages = useCallback(
    async (userId) => {
      if (!userId || isFetchingMessagesRef.current || !auth.token || !isValidObjectId(userId)) {
        return;
      }
      isFetchingMessagesRef.current = true;
      setIsLoadingMessages(true);

      try {
        const res = await axios.get(`${BASE_URL}/api/messages/${userId}?page=1&limit=50`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        const fetchedMessages = res.data.data.messages || [];
        cache.current.messages[userId] = fetchedMessages;
        setMessages(fetchedMessages);

        const unreadMessages = fetchedMessages.filter((msg) => !msg.read && !msg.fromSelf);
        if (unreadMessages.length > 0) {
          try {
            await axios.post(
              `${BASE_URL}/api/messages/mark-read`,
              { messageIds: unreadMessages.map((msg) => msg.id) },
              { headers: { Authorization: `Bearer ${auth.token}` } }
            );
            cache.current.messages[userId] = fetchedMessages.map((m) =>
              unreadMessages.some((unread) => unread.id === m.id) ? { ...m, read: true } : m
            );
            setMessages((prev) =>
              prev.map((m) =>
                unreadMessages.some((unread) => unread.id === m.id) ? { ...m, read: true } : m
              )
            );
            setUnreadCounts((prev) => ({
              ...prev,
              [userId]: 0,
            }));
            updateFavicon(Object.values(unreadCounts).some((count) => count > 0));
          } catch (err) {
            console.error('Error marking messages as read:', err.response?.data || err.message);
            toast.error('Failed to mark messages as read.');
          }
        }
        setHasSentAutoHi(false);
        scrollToBottom(true);
      } catch (err) {
        console.error('Error fetching messages:', err.response?.data || err.message);
        if (cache.current.messages[userId]?.length > 0) {
          setMessages(cache.current.messages[userId]);
          toast.warn('Failed to fetch messages, showing cached messages.');
        } else if (err.response?.status === 401 || err.response?.status === 400) {
          toast.error('Session expired. Please log in again.');
          logout();
          navigate('/login');
        } else if (err.response?.status === 404) {
          toast.error('Recipient not found.');
          setSelectedUser(null);
          setShowChat(false);
        } else {
          toast.error('Failed to load messages. Please try again.');
        }
      } finally {
        isFetchingMessagesRef.current = false;
        setIsLoadingMessages(false);
      }
    },
    [auth.token, logout, navigate, updateFavicon, unreadCounts, scrollToBottom]
  );

  const debouncedFetchMessages = useMemo(
    () => debounce(fetchMessages, 300),
    [fetchMessages]
  );

  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;

    socketRef.current = io(SOCKET_URL, {
      auth: { token: auth.token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 5000,
      reconnectionDelayMax: 10000,
      transports: ['websocket', 'polling'],
      forceNew: false,
    });

    socketRef.current.on('connect', () => {
      console.log('Socket.IO connected');
      fetchUnreadCounts();
      socketRef.current.emit('user-connected', { userId });
    });
    socketRef.current.on('online-users', ({ users }) => {
      setOnlineUsers(new Set(users)); // Expecting an array of user IDs
    });

    // Listen for user connection
    socketRef.current.on('user-connected', ({ userId }) => {
      if (isValidObjectId(userId)) {
        setOnlineUsers((prev) => new Set(prev).add(userId));
      }
    });

    // Listen for user disconnection
    socketRef.current.on('user-disconnected', ({ userId }) => {
      if (isValidObjectId(userId)) {
        setOnlineUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      }
    });
    socketRef.current.on('receive-message', (data) => {
      const userId = getUserId();
      if (!userId || !isValidObjectId(data.from) || !isValidObjectId(data.to)) return;

      const message = {
        fromSelf: data.from === userId,
        content: data.message,
        createdAt: new Date(data.createdAt).toISOString(),
        id: data.id,
        read: data.read,
      };

      const otherUserId = message.fromSelf ? data.to : data.from;
      cache.current.messages[otherUserId] = cache.current.messages[otherUserId] || [];

      if (cache.current.messages[otherUserId].some((msg) => msg.id === message.id)) return;

      cache.current.messages[otherUserId].push(message);

      if (otherUserId === selectedUser?._id) {
        setMessages((prev) => {
          if (prev.some((msg) => msg.id === message.id)) return prev;
          const updatedMessages = [...prev, { ...message, isNew: true }];
          if (!message.fromSelf && !message.read) {
            socketRef.current.emit('message-read', { messageId: message.id });
            setUnreadCounts((prev) => ({
              ...prev,
              [otherUserId]: 0,
            }));
            updateFavicon(Object.values(unreadCounts).some((count) => count > 0));
          }
          return updatedMessages;
        });
        scrollToBottom(true);
      } else if (!message.fromSelf) {
        setUnreadCounts((prev) => ({
          ...prev,
          [otherUserId]: (prev[otherUserId] || 0) + 1,
        }));
        updateFavicon(true);
      }

      setLastMessageTimes((prev) => ({
        ...prev,
        [otherUserId]: new Date(data.createdAt).getTime(),
      }));
    });

    socketRef.current.on('message-read', ({ messageId }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, read: true } : msg))
      );
      if (selectedUser) {
        cache.current.messages[selectedUser._id] = cache.current.messages[selectedUser._id].map(
          (msg) => (msg.id === messageId ? { ...msg, read: true } : msg)
        );
        setUnreadCounts((prev) => ({
          ...prev,
          [selectedUser._id]: 0,
        }));
        updateFavicon(Object.values(unreadCounts).some((count) => count > 0));
      }
    });

    socketRef.current.on('typing', (data) => {
      if (data.userId === selectedUser?._id) {
        setIsTyping(true);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      }
    });

    socketRef.current.on('new-user', (newUser) => {
      const userId = getUserId();
      if (newUser.id !== userId && isValidObjectId(newUser.id)) {
        setUsers((prev) => {
          if (prev.some((u) => u._id === newUser.id)) return prev;
          return [...prev, { _id: newUser.id, name: newUser.name, email: newUser.email }];
        });
        setFilteredUsers((prev) => {
          if (prev.some((u) => u._id === newUser.id)) return prev;
          return [...prev, { _id: newUser.id, name: newUser.name, email: newUser.email }];
        });
        cache.current.users = cache.current.users
          ? [...cache.current.users, { _id: newUser.id, name: newUser.name, email: newUser.email }]
          : [{ _id: newUser.id, name: newUser.name, email: newUser.email }];
        toast.info(`New user joined: ${newUser.name}`);
      }
    });

    return () => {
      socketRef.current?.emit('user-disconnected', { userId });
      socketRef.current?.disconnect();
      clearTimeout(typingTimeoutRef.current);
    };
  }, [auth.token, getUserId, logout, navigate, selectedUser, updateFavicon, fetchUnreadCounts]);

  useEffect(() => {
    if (auth.token && auth.user) {
      setUserName(auth.user.name);
      fetchUsers();
    } else {
      navigate('/login');
    }
  }, [auth.token, auth.user, navigate, fetchUsers]);

  useEffect(() => {
    if (selectedUser && auth.token) {
      if (!isValidObjectId(selectedUser._id)) {
        toast.error('Invalid user selected. Please try another user.');
        setSelectedUser(null);
        setShowChat(false);
        return;
      }
      if (cache.current.messages[selectedUser._id]?.length > 0) {
        setMessages(cache.current.messages[selectedUser._id]);
        scrollToBottom(true);
      }
      debouncedFetchMessages(selectedUser._id);
    }
    return () => debouncedFetchMessages.cancel();
  }, [selectedUser, auth.token, debouncedFetchMessages, scrollToBottom]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSearch = useCallback((value) => {
    setSearch(value);
  }, []);

  const filteredUsersMemo = useMemo(() => {
    const searchLower = search.toLowerCase();
    const sortedUsers = [...users].sort((a, b) => {
      const timeA = lastMessageTimes[a._id] || 0;
      const timeB = lastMessageTimes[b._id] || 0;
      return timeB - timeA;
    });
    return searchLower
      ? sortedUsers.filter((u) => u.name.toLowerCase().includes(searchLower))
      : sortedUsers;
  }, [users, lastMessageTimes, search]);

  const handleSelectUser = useCallback(
    debounce((user) => {
      if (!isValidObjectId(user._id)) {
        toast.error('Invalid user selected.');
        return;
      }
      if (selectedUser?._id !== user._id) {
        setSelectedUser(user);
        setShowChat(true);
        setHasSentAutoHi(false);
        setMessages([]);
        isNearBottomRef.current = true;
        scrollToBottom(true);
      }
    }, 300),
    [selectedUser, scrollToBottom]
  );

  const handleBackToUsers = useCallback(() => {
    setShowChat(false);
    setSelectedUser(null);
    setMessages([]);
    setHasSentAutoHi(false);
  }, []);

  const handleSend = useCallback(
    async (e, customMessage = null) => {
      e.preventDefault();
      const messageToSend = customMessage ?? newMessage.trim();
      if (!messageToSend || !selectedUser || !auth.token || !isValidObjectId(selectedUser._id)) {
        toast.error('Cannot send message. Please select a valid user.');
        return;
      }
      setIsSending(true);

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const optimisticMsg = {
        fromSelf: true,
        content: messageToSend,
        createdAt: new Date().toISOString(),
        id: tempId,
        read: false,
        isNew: true,
      };

      // Update messages and cache
      setMessages((prev) => {
        const updatedMessages = [...prev, optimisticMsg];
        cache.current.messages[selectedUser._id] = cache.current.messages[selectedUser._id] || [];
        cache.current.messages[selectedUser._id] = updatedMessages;
        return updatedMessages;
      });

      if (!customMessage) setNewMessage('');
      if (customMessage) setHasSentAutoHi(true);
      isNearBottomRef.current = true;
      scrollToBottom(true);

      try {
        const res = await axios.post(
          `${BASE_URL}/api/messages`,
          { to: selectedUser._id, message: messageToSend },
          { headers: { Authorization: `Bearer ${auth.token}` } }
        );
        const newMsg = {
          fromSelf: true,
          content: res.data.data.content,
          createdAt: res.data.data.createdAt,
          id: res.data.data.id,
          read: res.data.data.read,
          isNew: true,
        };

        setMessages((prev) => {
          const updatedMessages = prev.filter((msg) => msg.id !== tempId);
          if (!updatedMessages.some((msg) => msg.id === newMsg.id)) {
            updatedMessages.push(newMsg);
          }
          cache.current.messages[selectedUser._id] = updatedMessages;
          return updatedMessages;
        });

        setLastMessageTimes((prev) => ({
          ...prev,
          [selectedUser._id]: new Date(res.data.data.createdAt).getTime(),
        }));
        scrollToBottom(true); // Ensure scroll after server response
      } catch (err) {
        console.error('Error sending message:', err);
        toast.error(`Failed to send message: ${err.response?.data?.error?.message || err.message}`);
        setMessages((prev) => {
          const updatedMessages = prev.filter((msg) => msg.id !== tempId);
          cache.current.messages[selectedUser._id] = updatedMessages;
          return updatedMessages;
        });
      } finally {
        setIsSending(false);
      }
    },
    [auth.token, selectedUser, newMessage, scrollToBottom]
  );

  const emitTyping = useMemo(
    () =>
      debounce(() => {
        if (socketRef.current?.connected && selectedUser && isValidObjectId(selectedUser._id)) {
          socketRef.current.emit('typing', { userId: selectedUser._id });
        }
      }, 500),
    [selectedUser]
  );

  const handleTyping = useCallback(
    (value) => {
      setNewMessage(value);
      if (value.trim()) emitTyping();
    },
    [emitTyping]
  );

  const MessageItem = React.memo(
    ({ msg }) => {
      const date = new Date(msg.createdAt);
      const timeString = isNaN(date.getTime())
        ? 'Unknown time'
        : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return (
        <div
          className={`flex mb-2 ${msg.fromSelf ? 'justify-end' : 'justify-start'} ${msg.isNew ? 'animate-fadeIn' : ''}`}
        >
          <div className={`flex flex-col max-w-[70%] ${msg.fromSelf ? 'items-end' : 'items-start'}`}>
            <div
              className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${msg.fromSelf ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800 border'}`}
            >
              {msg.content}
            </div>
            <div className="text-xs text-gray-500 mt-1 flex items-center">
              {timeString}
              {msg.read && msg.fromSelf && <span className="ml-2">✔✔</span>}
            </div>
          </div>
        </div>
      );
    },
    (prevProps, nextProps) => prevProps.msg.id === nextProps.msg.id && prevProps.msg.read === nextProps.msg.read
  );

  return (
    <div className="h-screen flex flex-col md:flex-row bg-gray-100">
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out;
          }
          .typing-indicator {
            min-height: 40px;
            transition: opacity 0.3s ease-out;
          }
          .typing-indicator.hidden {
            opacity: 0;
            visibility: hidden;
          }
          .message-container {
            overscroll-behavior: contain;
            scroll-behavior: smooth;
          }
          .message-container::-webkit-scrollbar {
            width: 6px;
          }
          .message-container::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
          }
          .message-container::-webkit-scrollbar-track {
            background: #f1f1f1;
          }
        `}
      </style>

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar />

      {(!isMobile || !showChat) && (
        <aside className="w-full md:w-1/3 lg:w-1/4 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
            <h2 className="text-xl font-semibold text-gray-800">
              {userName.charAt(0).toUpperCase() + userName.slice(1)}
            </h2>
            <Link
              to="/"
              className="text-blue-500 hover:underline flex items-center text-sm"
              aria-label="Go to home page"
            >
              <ArrowBigLeftDash className="w-6 h-7 mr-2" /> Home
            </Link>
          </div>

          <div className="p-4 border-b">
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full px-3 py-2 border rounded-full bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {isLoadingUsers ? (
            <p className="p-4 text-gray-500 text-sm">Loading users...</p>
          ) : filteredUsersMemo.length > 0 ? (
            <ul>
              {filteredUsersMemo.map((user) => (
                <li
                  key={user._id}
                  className={`p-4 border-b hover:bg-gray-50 cursor-pointer transition-colors duration-200 ${selectedUser?._id === user._id ? 'bg-gray-100' : unreadCounts[user._id] > 0 ? 'bg-blue-50' : ''}`}
                  onClick={() => handleSelectUser(user)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelectUser(user)}
                  aria-label={`Chat with ${user.name}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative w-10 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium">
                      {getInitials(user.name)}
                      <span
                        className={`absolute top-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${onlineUsers.has(user._id) ? 'bg-green-500' : 'bg-gray-500'
                          }`}
                      ></span>
                    </div>
                    <div className="flex-1 flex justify-between">
                      <div className="font-medium text-gray-700">
                        {user.name.charAt(0).toUpperCase() + user.name.slice(1)}
                      </div>
                      {unreadCounts[user._id] > 0 && (
                        <span className="bg-red-600 text-white text-xs font-semibold rounded-full px-2 py-1">
                          {unreadCounts[user._id]}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-gray-500 text-sm">No users found.</p>
          )}
        </aside>
      )}

      {selectedUser && (!isMobile || showChat) ? (
        <main className="flex-1 flex flex-col bg-gradient-to-b from-gray-50 to-gray-100">
          <div className="p-4 border-b bg-white flex justify-between items-center shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold">
                {getInitials(selectedUser.name)}
              </div>
              <h3 className="text-lg font-semibold text-gray-800">
                {selectedUser.name.charAt(0).toUpperCase() + selectedUser.name.slice(1)}
                <p className={`text-sm ${onlineUsers.has(selectedUser._id) ? 'text-green-500' : 'text-gray-500'}`}>
                  {onlineUsers.has(selectedUser._id) ? 'Online' : 'Offline'}
                </p>
              </h3>
            </div>
            {isMobile && (
              <button
                onClick={handleBackToUsers}
                className="text-sm text-blue-500 hover:text-blue-600 flex items-center"
                aria-label="Back to user list"
              >
                <ArrowBigLeftDash className="w-7 h-7 mr-2" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 message-container" ref={scrollContainerRef}>
            {isLoadingMessages ? (
              <div className="flex justify-center items-center h-full text-gray-600">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center h-full cursor-pointer transition-colors duration-200"
                onClick={() => !hasSentAutoHi && handleSend({ preventDefault: () => { } }, 'Hi 👋')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === 'Enter' && !hasSentAutoHi && handleSend({ preventDefault: () => { } }, 'Hi 👋')
                }
                aria-label="Send initial greeting"
              >
                <div className="flex text-2xl items-center justify-center space-x-2 mb-4">
                  <span className="text-gray-500">Say</span>
                  <p className="flex items-center space-x-1">
                    <span>(Hi</span>
                    <span role="img" aria-label="wave">👋</span>
                    <span>)</span>
                  </p>
                </div>
                <p className="text-sm italic text-gray-500">
                  {hasSentAutoHi ? 'Hi sent! Waiting for reply...' : 'No messages yet — click to send hi!'}
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageItem key={msg.id} msg={msg} />
                ))}
                <div className={`typing-indicator ${!isTyping ? 'hidden' : ''}`}>
                  <div className="flex justify-start mb-2">
                    <div className="px-3 py-2 rounded-2xl bg-gray-200 shadow-sm max-w-xs text-xs">
                      <div className="flex space-x-1">
                        <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce [animation-delay:0s]"></span>
                        <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <form
            className="p-2 bg-white border-t border-gray-200 flex gap-3 shadow-sm"
            onSubmit={handleSend}
            aria-label="Send message form"
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => handleTyping(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 border rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className={`bg-blue-500 text-white px-5 py-2 rounded-full hover:bg-blue-600 transition-colors duration-200 ${!newMessage.trim() || isSending ? 'opacity-70 cursor-not-allowed' : ''}`}
              aria-label="Send message"
            >
              {isSending ? 'Sending...' : <MousePointer2 style={{ rotate: '90deg' }} />}
            </button>
          </form>
        </main>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-100">
          <MessageCircle className="w-12 h-12 mb-4 text-gray-400" />
          <h2 className="text-xl font-medium text-gray-700">No chat selected</h2>
          <p className="text-sm text-gray-500">Select a user from the list to start a conversation.</p>
        </div>
      )}
    </div>
  );
};

export default Messages;