import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowBigLeftDash, MessageCircle, MousePointer2, UserPlus, UserMinus, Check, X, Ban } from 'lucide-react';
import axios from 'axios';
import io from 'socket.io-client';
import { debounce } from 'lodash';
import { useAuth } from './context/AuthContext';
import { jwtDecode } from 'jwt-decode';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Messages = () => {
  const [users, setUsers] = useState([]); // Followed users
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchedUsers, setSearchedUsers] = useState([]);
  const [followRequests, setFollowRequests] = useState([]); // Incoming follow requests
  const [filteredRequests, setFilteredRequests] = useState([]);
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
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [lastMessageTimes, setLastMessageTimes] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' or 'requests'
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
    followRequests: null,
    messages: {},
    lastMessageTimes: {},
    unreadCounts: {},
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
    return scrollTop + clientHeight >= scrollHeight - 50;
  }, []);

  const scrollToBottom = useCallback((immediate = false) => {
    if (!scrollContainerRef.current || !isNearBottomRef.current) return;
    const behavior = immediate ? 'auto' : 'smooth';
    scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior });
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
    // Initial scroll
    scrollToBottom(true);
    return () => {
      observer.unobserve(scrollContainer);
      scrollContainer.removeEventListener('scroll', handleScroll);
      debouncedResize.cancel();
    };
  }, [isNearBottom, scrollToBottom]);

  // Scroll for new messages or typing
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

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
        cache.current.unreadCounts = counts;
        updateFavicon(Object.values(counts).some((count) => count > 0));
      } catch (err) {
        console.error('Error fetching unread counts:', err);
        if (retryCount < 3) {
          setTimeout(() => fetchUnreadCounts(retryCount + 1), 2000);
        }
      } finally {
        isFetchingUnreadCountsRef.current = false;
      }
    },
    [auth.token, getUserId, updateFavicon]
  );

  const fetchLastMessageTimes = useCallback(async (userList) => {
    const times = { ...cache.current.lastMessageTimes };
    const promises = userList.map(async (user) => {
      if (times[user._id] || !isValidObjectId(user._id)) return;
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
    });
    await Promise.allSettled(promises);
    setLastMessageTimes(times);
    cache.current.lastMessageTimes = times;
  }, [auth.token]);

  const fetchFollowedUsers = useCallback(
    async () => {
      const userId = getUserId();
      if (!userId) return;
      setIsLoadingUsers(true);
      if (cache.current.users) {
        const others = cache.current.users.filter((u) => u._id !== userId);
        setUsers(others);
        setFilteredUsers(others);
        setLastMessageTimes(cache.current.lastMessageTimes);
        setUnreadCounts(cache.current.unreadCounts);
        updateFavicon(Object.values(cache.current.unreadCounts).some((count) => count > 0));
        setIsLoadingUsers(false);
        return;
      }
      try {
        const res = await axios.get(`${BASE_URL}/api/followed-users`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        const usersList = res.data.data?.users ?? [];
        cache.current.users = usersList;
        const others = usersList.filter((u) => u._id !== userId);
        setUsers(others);
        setFilteredUsers(others);
        await Promise.all([fetchLastMessageTimes(others), fetchUnreadCounts()]);
      } catch (err) {
        console.error('Error fetching followed users:', err);
        toast.error('Failed to load users. Please try again.');
      } finally {
        setIsLoadingUsers(false);
      }
    },
    [auth.token, getUserId, fetchLastMessageTimes, fetchUnreadCounts, updateFavicon]
  );

  const fetchFollowRequests = useCallback(
    async () => {
      const userId = getUserId();
      if (!userId) return;
      setIsLoadingRequests(true);
      if (cache.current.followRequests) {
        setFollowRequests(cache.current.followRequests);
        setFilteredRequests(cache.current.followRequests);
        setIsLoadingRequests(false);
        return;
      }
      try {
        const res = await axios.get(`${BASE_URL}/api/follow-requests/incoming`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        const requestsList = res.data.data?.requests ?? [];
        cache.current.followRequests = requestsList;
        setFollowRequests(requestsList);
        setFilteredRequests(requestsList);
      } catch (err) {
        console.error('Error fetching follow requests:', err);
        toast.error('Failed to load follow requests. Please try again.');
      } finally {
        setIsLoadingRequests(false);
      }
    },
    [auth.token, getUserId]
  );

  const fetchMessages = useCallback(
    async (userId) => {
      if (!userId || isFetchingMessagesRef.current || !auth.token || !isValidObjectId(userId)) return;
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
          await axios.post(
            `${BASE_URL}/api/messages/mark-read`,
            { messageIds: unreadMessages.map((msg) => msg.id) },
            { headers: { Authorization: `Bearer ${auth.token}` } }
          );
          const updatedMessages = fetchedMessages.map((m) =>
            unreadMessages.some((unread) => unread.id === m.id) ? { ...m, read: true } : m
          );
          cache.current.messages[userId] = updatedMessages;
          setMessages(updatedMessages);
          setUnreadCounts((prev) => ({ ...prev, [userId]: 0 }));
          updateFavicon(Object.values({ ...cache.current.unreadCounts, [userId]: 0 }).some((count) => count > 0));
        }
        setHasSentAutoHi(false);
        scrollToBottom(true);
      } catch (err) {
        console.error('Error fetching messages:', err);
        if (cache.current.messages[userId]?.length > 0) {
          setMessages(cache.current.messages[userId]);
        } else {
          toast.error('Failed to load messages.');
        }
      } finally {
        isFetchingMessagesRef.current = false;
        setIsLoadingMessages(false);
      }
    },
    [auth.token, scrollToBottom, updateFavicon]
  );

  const debouncedFetchMessages = useMemo(() => debounce(fetchMessages, 300), [fetchMessages]);

  const debouncedSearch = useMemo(
    () =>
      debounce(async (query) => {
        try {
          const res = await axios.get(`${BASE_URL}/api/users/search?query=${query}`, {
            headers: { Authorization: `Bearer ${auth.token}` },
          });
          setSearchedUsers(res.data.data.users.filter((u) => u._id !== getUserId()));
        } catch (err) {
          console.error('Error searching users:', err);
        }
      }, 500),
    [auth.token, getUserId]
  );

  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;
    socketRef.current = io(SOCKET_URL, {
      auth: { token: auth.token },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket'],
    });
    socketRef.current.on('connect', () => {
      socketRef.current.emit('user-connected', { userId });
      fetchUnreadCounts();
    });
    socketRef.current.on('online-users', ({ users }) => setOnlineUsers(new Set(users)));
    socketRef.current.on('user-connected', ({ userId }) => {
      if (isValidObjectId(userId)) setOnlineUsers((prev) => new Set([...prev, userId]));
    });
    socketRef.current.on('user-disconnected', ({ userId }) => {
      if (isValidObjectId(userId)) setOnlineUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
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
          const updated = [...prev, message];
          if (!message.fromSelf && !message.read) {
            socketRef.current.emit('message-read', { messageId: message.id });
            setUnreadCounts((prev) => ({ ...prev, [otherUserId]: 0 }));
            cache.current.unreadCounts[otherUserId] = 0;
            updateFavicon(Object.values(cache.current.unreadCounts).some((c) => c > 0));
          }
          return updated;
        });
        scrollToBottom();
      } else if (!message.fromSelf) {
        setUnreadCounts((prev) => {
          const updated = { ...prev, [otherUserId]: (prev[otherUserId] || 0) + 1 };
          cache.current.unreadCounts = updated;
          updateFavicon(true);
          return updated;
        });
      }
      setLastMessageTimes((prev) => {
        const updated = { ...prev, [otherUserId]: new Date(data.createdAt).getTime() };
        cache.current.lastMessageTimes = updated;
        return updated;
      });
    });
    socketRef.current.on('message-read', ({ messageId }) => {
      setMessages((prev) => prev.map((msg) => msg.id === messageId ? { ...msg, read: true } : msg));
      if (selectedUser) {
        cache.current.messages[selectedUser._id] = cache.current.messages[selectedUser._id].map((msg) =>
          msg.id === messageId ? { ...msg, read: true } : msg
        );
        setUnreadCounts((prev) => ({ ...prev, [selectedUser._id]: 0 }));
        cache.current.unreadCounts[selectedUser._id] = 0;
        updateFavicon(Object.values(cache.current.unreadCounts).some((c) => c > 0));
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
        setUsers((prev) => prev.some((u) => u._id === newUser.id) ? prev : [...prev, { _id: newUser.id, name: newUser.name, email: newUser.email }]);
        setFilteredUsers((prev) => prev.some((u) => u._id === newUser.id) ? prev : [...prev, { _id: newUser.id, name: newUser.name, email: newUser.email }]);
        cache.current.users = cache.current.users ? [...cache.current.users, { _id: newUser.id, name: newUser.name, email: newUser.email }] : [{ _id: newUser.id, name: newUser.name, email: newUser.email }];
      }
    });
    // New socket events for follow/block updates
    socketRef.current.on('follow-request', (request) => {
      setFollowRequests((prev) => [...prev, request]);
      cache.current.followRequests = [...(cache.current.followRequests || []), request];
      toast.info(`New follow request from ${request.name}`);
    });
    socketRef.current.on('follow-accepted', ({ user }) => {
      setUsers((prev) => [...prev, user]);
      cache.current.users = [...(cache.current.users || []), user];
      toast.success(`${user.name} accepted your follow request!`);
    });
    return () => {
      socketRef.current?.emit('user-disconnected', { userId });
      socketRef.current?.disconnect();
      clearTimeout(typingTimeoutRef.current);
    };
  }, [auth.token, getUserId, selectedUser, updateFavicon, fetchUnreadCounts, scrollToBottom]);

  useEffect(() => {
    if (auth.token && auth.user) {
      setUserName(auth.user.name);
      fetchFollowedUsers();
      fetchFollowRequests();
    } else {
      navigate('/login');
    }
  }, [auth.token, auth.user, navigate, fetchFollowedUsers, fetchFollowRequests]);

  useEffect(() => {
    if (selectedUser && auth.token) {
      if (!isValidObjectId(selectedUser._id)) {
        toast.error('Invalid user selected.');
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
    const handleResize = debounce(() => setIsMobile(window.innerWidth < 768), 100);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      handleResize.cancel();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'chats' && search.trim()) {
      debouncedSearch(search);
    } else if (activeTab === 'chats') {
      setSearchedUsers([]);
      setFilteredUsers(users.sort((a, b) => (lastMessageTimes[b._id] || 0) - (lastMessageTimes[a._id] || 0)));
    }
  }, [search, activeTab, debouncedSearch, users, lastMessageTimes]);

  useEffect(() => {
    if (search && activeTab === 'chats') {
      setFilteredUsers(searchedUsers.sort((a, b) => (lastMessageTimes[b._id] || 0) - (lastMessageTimes[a._id] || 0)));
    }
  }, [searchedUsers, search, activeTab, lastMessageTimes]);

  const handleSearch = useCallback((value) => {
    setSearch(value);
    const searchLower = value.toLowerCase();
    if (activeTab === 'requests') {
      setFilteredRequests(followRequests.filter((r) => r.name.toLowerCase().includes(searchLower)));
    }
  }, [activeTab, followRequests]);

  const handleSelectUser = useCallback((user) => {
    if (!isValidObjectId(user._id)) return;
    if (selectedUser?._id !== user._id) {
      setSelectedUser(user);
      setShowChat(true);
      setHasSentAutoHi(false);
      setMessages([]);
      isNearBottomRef.current = true;
      scrollToBottom(true);
    }
  }, [selectedUser, scrollToBottom]);

  const handleBackToUsers = useCallback(() => {
    setShowChat(false);
    setSelectedUser(null);
    setMessages([]);
    setHasSentAutoHi(false);
  }, []);

  const handleFollow = useCallback(async (userId) => {
    if (!isValidObjectId(userId)) return;
    try {
      await axios.post(`${BASE_URL}/api/follow/${userId}`, {}, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      setSearchedUsers((prev) => prev.map((u) => u._id === userId ? { ...u, isPending: true } : u));
      toast.success('Follow request sent!');
    } catch (err) {
      console.error('Error sending follow request:', err);
      toast.error('Failed to send follow request.');
    }
  }, [auth.token]);

  const handleUnfollow = useCallback(async (userId) => {
    if (!isValidObjectId(userId)) return;
    try {
      await axios.delete(`${BASE_URL}/api/follow/${userId}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      setFilteredUsers((prev) => prev.filter((u) => u._id !== userId));
      setSearchedUsers((prev) => prev.map((u) => u._id === userId ? { ...u, isFollowing: false } : u));
      cache.current.users = cache.current.users.filter((u) => u._id !== userId);
      if (selectedUser?._id === userId) {
        handleBackToUsers();
      }
      toast.success('Unfollowed user.');
    } catch (err) {
      console.error('Error unfollowing user:', err);
      toast.error('Failed to unfollow user.');
    }
  }, [auth.token, selectedUser, handleBackToUsers]);

  const handleAcceptRequest = useCallback(async (requestId) => {
    if (!isValidObjectId(requestId)) return;
    try {
      const res = await axios.post(`${BASE_URL}/api/follow-requests/accept/${requestId}`, {}, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const newUser = res.data.data.user;
      setUsers((prev) => [...prev, newUser]);
      setFilteredUsers((prev) => [...prev, newUser]);
      cache.current.users = [...(cache.current.users || []), newUser];
      setFollowRequests((prev) => prev.filter((r) => r.requestId !== requestId));
      setFilteredRequests((prev) => prev.filter((r) => r.requestId !== requestId));
      cache.current.followRequests = cache.current.followRequests.filter((r) => r.requestId !== requestId);
      toast.success('Follow request accepted!');
    } catch (err) {
      console.error('Error accepting request:', err);
      toast.error('Failed to accept request.');
    }
  }, [auth.token]);

  const handleRejectRequest = useCallback(async (requestId) => {
    if (!isValidObjectId(requestId)) return;
    try {
      await axios.post(`${BASE_URL}/api/follow-requests/reject/${requestId}`, {}, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      setFollowRequests((prev) => prev.filter((r) => r.requestId !== requestId));
      setFilteredRequests((prev) => prev.filter((r) => r.requestId !== requestId));
      cache.current.followRequests = cache.current.followRequests.filter((r) => r.requestId !== requestId);
      toast.success('Follow request rejected.');
    } catch (err) {
      console.error('Error rejecting request:', err);
      toast.error('Failed to reject request.');
    }
  }, [auth.token]);

  const handleBlock = useCallback(async (userId) => {
    if (!isValidObjectId(userId)) return;
    try {
      await axios.post(`${BASE_URL}/api/block/${userId}`, {}, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      setFilteredUsers((prev) => prev.filter((u) => u._id !== userId));
      setSearchedUsers((prev) => prev.filter((u) => u._id !== userId));
      cache.current.users = cache.current.users.filter((u) => u._id !== userId);
      if (selectedUser?._id === userId) {
        handleBackToUsers();
      }
      toast.success('User blocked.');
    } catch (err) {
      console.error('Error blocking user:', err);
      toast.error('Failed to block user.');
    }
  }, [auth.token, selectedUser, handleBackToUsers]);

  const handleSend = useCallback(
    async (e, customMessage = null) => {
      e.preventDefault();
      const messageToSend = customMessage ?? newMessage.trim();
      if (!messageToSend || !selectedUser || !auth.token || !isValidObjectId(selectedUser._id)) return;
      // Additional check: Ensure user is followed (though list already filters)
      if (!users.some(u => u._id === selectedUser._id)) {
        toast.error('You can only message followed users.');
        return;
      }
      setIsSending(true);
      const tempId = `temp-${Date.now()}`;
      const optimisticMsg = {
        fromSelf: true,
        content: messageToSend,
        createdAt: new Date().toISOString(),
        id: tempId,
        read: false,
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      cache.current.messages[selectedUser._id] = [...(cache.current.messages[selectedUser._id] || []), optimisticMsg];
      if (!customMessage) setNewMessage('');
      if (customMessage) setHasSentAutoHi(true);
      scrollToBottom();
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
        };
        setMessages((prev) => {
          let updated = prev.filter((msg) => msg.id !== tempId);
          if (!updated.some((msg) => msg.id === newMsg.id)) {
            updated = [...updated, newMsg];
          }
          return updated;
        });
        cache.current.messages[selectedUser._id] = cache.current.messages[selectedUser._id].filter((msg) => msg.id !== tempId);
        if (!cache.current.messages[selectedUser._id].some((msg) => msg.id === newMsg.id)) {
          cache.current.messages[selectedUser._id].push(newMsg);
        }
        setLastMessageTimes((prev) => ({ ...prev, [selectedUser._id]: new Date(res.data.data.createdAt).getTime() }));
        cache.current.lastMessageTimes[selectedUser._id] = new Date(res.data.data.createdAt).getTime();
        scrollToBottom();
      } catch (err) {
        console.error('Error sending message:', err);
        toast.error('Failed to send message.');
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
        cache.current.messages[selectedUser._id] = cache.current.messages[selectedUser._id].filter((msg) => msg.id !== tempId);
      } finally {
        setIsSending(false);
      }
    },
    [auth.token, selectedUser, newMessage, scrollToBottom, users]
  );

  const emitTyping = useMemo(
    () => debounce(() => {
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

  const MessageItem = React.memo(({ msg }) => {
    const date = new Date(msg.createdAt);
    const timeString = isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <div className={`flex mb-2 ${msg.fromSelf ? 'justify-end' : 'justify-start'}`}>
        <div className={`flex flex-col max-w-[70%] ${msg.fromSelf ? 'items-end' : 'items-start'}`}>
          <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${msg.fromSelf ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800 border'}`}>
            {msg.content}
          </div>
          <div className="text-xs text-gray-500 mt-1 flex items-center">
            {timeString}
            {msg.read && msg.fromSelf && <span className="ml-2">✔✔</span>}
          </div>
        </div>
      </div>
    );
  });

  return (
    <div className="h-screen flex flex-col md:flex-row bg-gray-100 overflow-hidden">
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
          @media (max-width: 640px) {
            .message-container {
              padding: 1rem;
            }
          }
        `}
      </style>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
      {(!isMobile || !showChat) && (
        <aside className="w-full md:w-1/3 lg:w-1/4 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b bg-white shrink-0">
            <h2 className="text-xl font-semibold text-gray-800 capitalize">{userName}</h2>
            <Link to="/" className="text-blue-500 hover:underline flex items-center text-sm" aria-label="Go to home page">
              <ArrowBigLeftDash className="w-6 h-7 mr-2" /> Home
            </Link>
          </div>
          <div className="flex border-b shrink-0">
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex-1 py-2 text-center ${activeTab === 'chats' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'} font-medium`}
            >
              Chats
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 py-2 text-center ${activeTab === 'requests' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'} font-medium`}
            >
              Requests {followRequests.length > 0 && `(${followRequests.length})`}
            </button>
          </div>
          <div className="p-4 border-b shrink-0">
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={activeTab === 'chats' ? 'Search users...' : 'Search requests...'}
              className="w-full px-3 py-2 border rounded-full bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          {activeTab === 'chats' ? (
            isLoadingUsers ? (
              <p className="p-4 text-gray-500 text-sm">Loading chats...</p>
            ) : filteredUsers.length > 0 ? (
              <ul className="overflow-y-auto flex-1">
                {filteredUsers.map((user) => (
                  <li
                    key={user._id}
                    className={`p-4 border-b hover:bg-gray-50 cursor-pointer transition-colors duration-200 ${selectedUser?._id === user._id ? 'bg-gray-100' : unreadCounts[user._id] > 0 ? 'bg-blue-50' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Interact with ${user.name}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3" onClick={() => user.isFollowing && handleSelectUser(user)}>
                        <div className="relative w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium">
                          {getInitials(user.name)}
                          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${onlineUsers.has(user._id) ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-700 capitalize">{user.name}</div>
                          {user.isFollowing && unreadCounts[user._id] > 0 && (
                            <span className="bg-red-600 text-white text-xs font-semibold rounded-full px-2 py-1 ml-2">
                              {unreadCounts[user._id]}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {user.isFollowing ? (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUnfollow(user._id); }}
                              className="text-red-500 hover:text-red-700"
                              aria-label={`Unfollow ${user.name}`}
                            >
                              <UserMinus className="w-5 h-5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleBlock(user._id); }}
                              className="text-gray-500 hover:text-gray-700"
                              aria-label={`Block ${user.name}`}
                            >
                              <Ban className="w-5 h-5" />
                            </button>
                          </>
                        ) : user.isPending ? (
                          <span className="text-gray-500 text-sm">Pending</span>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleFollow(user._id); }}
                            className="text-blue-500 hover:text-blue-700"
                            aria-label={`Follow ${user.name}`}
                          >
                            <UserPlus className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-gray-500 text-sm">No users found. Try searching for new friends.</p>
            )
          ) : (
            isLoadingRequests ? (
              <p className="p-4 text-gray-500 text-sm">Loading requests...</p>
            ) : filteredRequests.length > 0 ? (
              <ul className="overflow-y-auto flex-1">
                {filteredRequests.map((request) => (
                  <li
                    key={request.requestId}
                    className="p-4 border-b hover:bg-gray-50 transition-colors duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium">
                          {getInitials(request.name)}
                        </div>
                        <div className="font-medium text-gray-700 capitalize">{request.name}</div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleAcceptRequest(request.requestId)}
                          className="text-green-500 hover:text-green-700"
                          aria-label={`Accept request from ${request.name}`}
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request.requestId)}
                          className="text-red-500 hover:text-red-700"
                          aria-label={`Reject request from ${request.name}`}
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-gray-500 text-sm">No pending requests.</p>
            )
          )}
        </aside>
      )}
      {selectedUser && (!isMobile || showChat) ? (
        <main className="flex-1 flex flex-col bg-gradient-to-b from-gray-50 to-gray-100 overflow-hidden">
          <div className="p-4 border-b bg-white flex justify-between items-center shadow-sm shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold">
                {getInitials(selectedUser.name)}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 capitalize">{selectedUser.name}</h3>
                <p className={`text-sm ${onlineUsers.has(selectedUser._id) ? 'text-green-500' : 'text-gray-500'}`}>
                  {onlineUsers.has(selectedUser._id) ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => handleUnfollow(selectedUser._id)}
                className="text-red-500 hover:text-red-700 flex items-center text-sm"
                aria-label="Unfollow user"
              >
                <UserMinus className="w-5 h-5 mr-1" /> Unfollow
              </button>
              <button
                onClick={() => handleBlock(selectedUser._id)}
                className="text-gray-500 hover:text-gray-700 flex items-center text-sm"
                aria-label="Block user"
              >
                <Ban className="w-5 h-5 mr-1" /> Block
              </button>
              {isMobile && (
                <button
                  onClick={handleBackToUsers}
                  className="text-blue-500 hover:text-blue-600 flex items-center"
                  aria-label="Back to user list"
                >
                  <ArrowBigLeftDash className="w-7 h-7" />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 message-container" ref={scrollContainerRef}>
            {isLoadingMessages ? (
              <div className="flex justify-center items-center h-full text-gray-600">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center h-full cursor-pointer transition-colors duration-200 hover:bg-gray-200 p-4 rounded-lg"
                onClick={() => !hasSentAutoHi && handleSend({ preventDefault: () => {} }, 'Hi 👋')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && !hasSentAutoHi && handleSend({ preventDefault: () => {} }, 'Hi 👋')}
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
            className="p-2 bg-white border-t border-gray-200 flex items-center gap-3 shadow-sm shrink-0"
            onSubmit={handleSend}
            aria-label="Send message form"
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => handleTyping(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 border rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className={`bg-blue-500 text-white px-6 py-3 rounded-full hover:bg-blue-600 transition-colors duration-200 flex items-center justify-center ${!newMessage.trim() || isSending ? 'opacity-70 cursor-not-allowed' : ''}`}
              aria-label="Send message"
            >
              {isSending ? 'Sending...' : <MousePointer2 className="rotate-90" />}
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