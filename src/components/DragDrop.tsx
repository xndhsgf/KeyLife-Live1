import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileVideo, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface DragDropProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
}

export default function DragDrop({ onFileSelect, isUploading }: DragDropProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        onFileSelect(file);
      } else {
        alert('Please upload a video file');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative border-2 border-dashed rounded-2xl p-12 transition-colors duration-300 flex flex-col items-center justify-center cursor-pointer
        ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/20 hover:border-indigo-500/50 hover:bg-white/5'}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !isUploading && fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="video/*"
        onChange={handleFileChange}
        disabled={isUploading}
      />
      
      <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center mb-6">
        {isUploading ? (
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
        ) : (
          <Upload className="w-10 h-10 text-indigo-400" />
        )}
      </div>
      
      <h3 className="text-xl font-semibold text-white mb-2">
        {isUploading ? 'Processing Video...' : 'Drop Video Here'}
      </h3>
      <p className="text-gray-400 text-sm text-center max-w-xs">
        Support MP4, MOV. Max file size 50MB.
      </p>
    </motion.div>
  );
}
