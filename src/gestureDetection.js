export const isRock = (landmarks) => {
  if (!landmarks || landmarks.length === 0) return false;
  
  const hand = landmarks[0];
  
  // Get landmark points
  const thumb_tip = hand[4];
  const index_tip = hand[8];
  const index_pip = hand[6];
  const index_mcp = hand[5];
  const middle_tip = hand[12];
  const middle_pip = hand[10];
  const ring_tip = hand[16];
  const ring_pip = hand[14];
  const pinky_tip = hand[20];
  const pinky_pip = hand[18];
  
  // Rock gesture: index and pinky extended, middle and ring curled
  const indexExtended = index_tip.y < index_pip.y;
  const pinkyExtended = pinky_tip.y < pinky_pip.y;
  const middleCurled = middle_tip.y > middle_pip.y;
  const ringCurled = ring_tip.y > ring_pip.y;
  
  console.log('Rock Check:', {
    indexExtended,
    pinkyExtended,
    middleCurled,
    ringCurled
  });
  
  return indexExtended && pinkyExtended && middleCurled && ringCurled;
};