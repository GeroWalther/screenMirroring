/**
 * Network utilities for auto-discovering stream server
 */

// Try to auto-detect the stream server IP address
export const discoverStreamServer = async () => {
  // Common local IP ranges to try
  const ipRanges = [
    '192.168.0',
    '192.168.1',
    '10.0.0',
    '172.16.0',
  ];
  
  const STREAM_PORT = 8082;
  const TIMEOUT_MS = 2000; // 2 second timeout per IP
  
  console.log('🔍 Discovering stream server...');
  
  // First try the hardcoded IP (most likely to work)
  const hardcodedIP = '192.168.0.26';
  const hardcodedUrl = `http://${hardcodedIP}:${STREAM_PORT}/web-receiver.html`;
  
  console.log('🎯 Trying hardcoded IP first:', hardcodedUrl);
  if (await testStreamUrl(hardcodedUrl, TIMEOUT_MS)) {
    console.log('✅ Found stream server at hardcoded IP:', hardcodedIP);
    return { ip: hardcodedIP, url: hardcodedUrl };
  }
  
  // If hardcoded doesn't work, try to discover
  for (const range of ipRanges) {
    console.log(`🔍 Trying IP range: ${range}.x`);
    
    // Try common IP addresses in this range
    const commonIPs = [1, 2, 10, 25, 26, 50, 100, 254];
    
    for (const lastOctet of commonIPs) {
      const ip = `${range}.${lastOctet}`;
      const url = `http://${ip}:${STREAM_PORT}/web-receiver.html`;
      
      console.log(`🔍 Testing: ${ip}`);
      
      if (await testStreamUrl(url, TIMEOUT_MS)) {
        console.log('✅ Found stream server at:', ip);
        return { ip, url };
      }
    }
  }
  
  console.log('❌ Could not discover stream server');
  
  // Fallback to hardcoded IP even if it didn't respond
  return { 
    ip: hardcodedIP, 
    url: hardcodedUrl 
  };
};

// Test if a stream URL is accessible
const testStreamUrl = async (url, timeoutMs = 2000) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, {
      method: 'HEAD', // Just check if the endpoint exists
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    // Consider it successful if we get any response (even 404 is better than network error)
    return response.status < 500;
  } catch (error) {
    // Network error, timeout, or abort
    return false;
  }
};

// Generate stream URL with room parameter
export const generateStreamUrl = (ip, room = 'living-room') => {
  const STREAM_PORT = 8082;
  return `http://${ip}:${STREAM_PORT}/web-receiver.html?room=${room}`;
};

// Get local network info (if available in React Native)
export const getNetworkInfo = async () => {
  try {
    // This would require additional React Native modules like @react-native-community/netinfo
    // For now, just return null and rely on discovery
    return null;
  } catch (error) {
    console.log('📱 Network info not available:', error.message);
    return null;
  }
};