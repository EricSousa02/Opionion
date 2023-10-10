import React, { useState } from 'react';

interface LikesCountProps {
  likes: string[];
}

const LikesCount: React.FC<LikesCountProps> = ({ likes }) => {
  const likesCount = likes.length;

  return (
    <>
      {likesCount <= 0 ? null : (
        <>
          • {likesCount} {likesCount === 1 ? 'like' : 'likes'}
        </>
      )}
    </>
  );
};

export default LikesCount;
