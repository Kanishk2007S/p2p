/**
 * Derives a secure hexadecimal SHA-256 hash from a room name and password combo.
 * This is used as a secure room channel ID for PeerJS coordination.
 */
export async function deriveRoomKey(roomName: string, roomPass: string): Promise<string> {
  const input = `${roomName.trim().toLowerCase()}_${roomPass.trim()}`;
  const msgBuffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.slice(0, 16); // 16 characters is long enough for a unique room identifier namespace
}
