
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FileMetadata, MaterialAsset, AppSettings, UserRecord, PresetBackground } from '../types';
import { db } from '../firebase';
import { doc, updateDoc, increment, getDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';

declare var SVGA: any;
declare var JSZip: any;
declare var protobuf: any;
declare var pako: any;

interface WorkspaceProps {
  metadata: FileMetadata;
  onCancel: () => void;
  settings: AppSettings | null;
  currentUser: UserRecord | null;
}

interface CustomLayer {
  id: string;
  name: string;
  url: string;
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
  zIndexMode: 'front' | 'back';
}

const TRANSPARENT_PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export const Workspace: React.FC<WorkspaceProps> = ({ metadata: initialMetadata, onCancel, settings, currentUser }) => {
  const [metadata, setMetadata] = useState<FileMetadata>(initialMetadata);
  const playerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);
  const layerInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState('AE Project');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportPhase, setExportPhase] = useState('');
  const [svgaInstance, setSvgaInstance] = useState<any>(null);
  const [replacingAssetKey, setReplacingAssetKey] = useState<string | null>(null);
  const [layerImages, setLayerImages] = useState<Record<string, string>>({});
  const [assetColors, setAssetColors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [activeSideTab, setActiveSideTab] = useState<'layers' | 'transforms' | 'bg'>('transforms');

  const [presetBgs, setPresetBgs] = useState<PresetBackground[]>([]);
  const [previewBg, setPreviewBg] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string>('none');
  const [watermark, setWatermark] = useState<string | null>(null);
  const [deletedKeys, setDeletedKeys] = useState<Set<string>>(new Set());
  
  const [bgPos, setBgPos] = useState({ x: 50, y: 50 });
  const [bgScale, setBgScale] = useState(100);
  const [svgaPos, setSvgaPos] = useState({ x: 0, y: 0 });
  const [svgaScale, setSvgaScale] = useState(1);
  const [wmPos, setWmPos] = useState({ x: 0, y: 0 });
  const [wmScale, setWmScale] = useState(0.3);

  const [customLayers, setCustomLayers] = useState<CustomLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [fadeConfig, setFadeConfig] = useState({ top: 0, bottom: 0, left: 0, right: 0 }); // Percentages 0-50
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [exportScale, setExportScale] = useState(1.0); // 0.1 to 1.0 for file size control
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const videoWidth = metadata.dimensions?.width || 750;
  const videoHeight = metadata.dimensions?.height || 1334;
  const cost = settings?.costs.svgaProcess || 5;

  // ... (existing effects)

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsProcessingVideo(true);
      setExportPhase('جاري معالجة الفيديو واستخراج الإطارات...');
      setIsExporting(true); // Show loading overlay

      try {
          // 1. Setup Video Element
          const video = document.createElement('video');
          video.src = URL.createObjectURL(file);
          video.muted = true;
          video.playsInline = true;
          await video.play();
          video.pause();
          
          // 2. Extract Metadata
          const duration = video.duration;
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const fps = 30; // Target FPS for SVGA (keep it reasonable)
          const totalFrames = Math.floor(duration * fps);

          // 3. Extract Audio
          // We can try to use the video file itself as audio if it's small, 
          // but better to decode and re-encode or just use the video file as source for preview.
          // For now, let's set it for preview.
          setAudioUrl(video.src);
          setOriginalAudioUrl(video.src);
          setAudioFile(file); // Use the video file as the audio source file (SVGA players might handle it or we might need to extract)

          // 4. Extract Frames
          const canvas = document.createElement('canvas');
          canvas.width = vw;
          canvas.height = vh;
          const ctx = canvas.getContext('2d');
          
          const newLayerImages: Record<string, string> = {};
          const newSprites: any[] = [];
          
          // We create ONE sprite that changes its imageKey every frame? 
          // Or one sprite per frame? 
          // SVGA "Image Sequence" usually involves swapping the 'imageKey' of a sprite.
          // But SVGA 2.0 SpriteEntity has a fixed `imageKey`.
          // So we must use multiple sprites (one per frame) or one sprite with a spritesheet (complex).
          // Let's use the "Multiple Sprites" approach (Standard for SVGA converters).
          // Sprite 0: Visible Frame 0.
          // Sprite 1: Visible Frame 1.
          
          // REMOVED DOWNSCALING LOGIC TO PRESERVE ORIGINAL DIMENSIONS
          // const maxDim = 750;
          // let scale = 1;
          // if (vw > maxDim || vh > maxDim) {
          //     scale = Math.min(maxDim / vw, maxDim / vh);
          //     canvas.width = vw * scale;
          //     canvas.height = vh * scale;
          // }

          for (let i = 0; i < totalFrames; i++) {
              const time = i / fps;
              video.currentTime = time;
              await new Promise(r => {
                  const onSeek = () => {
                      video.removeEventListener('seeked', onSeek);
                      r(null);
                  };
                  video.addEventListener('seeked', onSeek);
              });
              
              if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  const quality = 0.8;
                  const dataUrl = canvas.toDataURL('image/png', quality); // PNG for quality
                  const key = `v_frame_${i}`;
                  newLayerImages[key] = dataUrl;
                  
                  // Create Sprite for this frame
                  const frames = [];
                  for (let f = 0; f < totalFrames; f++) {
                      frames.push({
                          alpha: f === i ? 1.0 : 0.0,
                          layout: { x: 0, y: 0, width: canvas.width, height: canvas.height },
                          transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                      });
                  }
                  
                  newSprites.push({
                      imageKey: key,
                      frames: frames,
                      matteKey: ""
                  });
              }
              setProgress(Math.floor((i / totalFrames) * 100));
          }

          // 5. Update Metadata
          setMetadata({
              ...metadata,
              name: file.name.replace('.mp4', ''),
              frames: totalFrames,
              fps: fps,
              dimensions: { width: canvas.width, height: canvas.height },
              videoItem: {
                  version: "2.0",
                  videoSize: { width: canvas.width, height: canvas.height },
                  FPS: fps,
                  frames: totalFrames,
                  images: newLayerImages,
                  sprites: newSprites,
                  audios: [] // We handle audio separately
              }
          });
          
          setLayerImages(newLayerImages);
          setCustomLayers([]); // Clear custom layers
          setWatermark(null); // Clear watermark
          
      } catch (e) {
          console.error(e);
          alert("فشل معالجة الفيديو");
      } finally {
          setIsProcessingVideo(false);
          setIsExporting(false);
      }
  };

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.volume = volume;
        audioRef.current.muted = isMuted;
        
        if (isPlaying && audioUrl) {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => console.log("Audio play prevented:", e));
            }
        } else {
            audioRef.current.pause();
        }
    }
  }, [isPlaying, audioUrl, volume, isMuted]);

  // Sync audio with animation frames
  useEffect(() => {
      if (audioRef.current && svgaInstance && metadata.fps) {
          const currentTime = currentFrame / metadata.fps;
          // Only sync if desynced by more than 0.2s to avoid stuttering
          if (Math.abs(audioRef.current.currentTime - currentTime) > 0.2) {
              audioRef.current.currentTime = currentTime;
          }
      }
  }, [currentFrame, metadata.fps]);

  useEffect(() => {
    const q = query(collection(db, "backgrounds"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setPresetBgs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PresetBackground[]);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const parent = containerRef.current.parentElement;
        if (parent) {
          const maxWidth = parent.clientWidth;
          const maxHeight = window.innerHeight * 0.85; 
          const s = Math.min(maxWidth / videoWidth, maxHeight / videoHeight);
          setScale(s);
        }
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [videoWidth, videoHeight]);

  const checkAndDeductCoins = async (): Promise<boolean> => {
    if (!currentUser) return false;
    if (currentUser.isVIP) return true;
    try {
      const userRef = doc(db, "users", currentUser.id);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserRecord;
        if ((userData.coins || 0) < cost) {
          alert(`رصيدك غير كافٍ. تحتاج إلى ${cost} كوينز. رصيدك الحالي: ${userData.coins || 0}`);
          return false;
        }
        await updateDoc(userRef, { coins: increment(-cost) });
        return true;
      }
      return false;
    } catch (e) { return false; }
  };

  const extractImageData = useCallback(async (img: any): Promise<string> => {
    if (!img) return '';
    if (typeof img === 'string') return img.startsWith('data:') ? img : `data:image/png;base64,${img}`;
    return new Promise((resolve) => {
      const processImage = (imgElement: HTMLImageElement | HTMLCanvasElement) => {
        try {
          const canvas = document.createElement('canvas');
          const w = (imgElement as HTMLImageElement).naturalWidth || imgElement.width || 200;
          const h = (imgElement as HTMLImageElement).naturalHeight || imgElement.height || 200;
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) { ctx.drawImage(imgElement, 0, 0, w, h); resolve(canvas.toDataURL('image/png')); }
          else resolve('');
        } catch (e) { resolve(''); }
      };
      if (img instanceof HTMLImageElement) {
        if (img.complete && img.naturalWidth > 0) processImage(img);
        else { img.onload = () => processImage(img); img.onerror = () => resolve(''); }
      } else if (img instanceof HTMLCanvasElement) processImage(img);
      else resolve('');
    });
  }, []);

  const tintImage = useCallback(async (base64: string, color: string): Promise<string> => {
    if (!color || color === '#ffffff') return base64;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          ctx.globalCompositeOperation = 'source-atop';
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1.0;
          resolve(canvas.toDataURL('image/png'));
        } else resolve(base64);
      };
      img.src = base64;
    });
  }, []);

  const getProcessedAsset = useCallback(async (key: string): Promise<string> => {
    const base64 = layerImages[key];
    if (!base64) return TRANSPARENT_PIXEL;
    const color = assetColors[key];
    if (color && color !== '#ffffff') {
      return await tintImage(base64, color);
    }
    return base64;
  }, [layerImages, assetColors, tintImage]);

  useEffect(() => {
    if (!metadata.videoItem) return;
    const fetchAssets = async () => {
      setAssetsLoading(true);
      const extractedImages: Record<string, string> = {};
      const sourceImages = metadata.videoItem.images || {};
      
      // Identify audio keys to skip during image extraction
      const audioKeys = new Set<string>();
      if (metadata.videoItem.audios) {
          metadata.videoItem.audios.forEach((audio: any) => {
              if (audio.audioKey) audioKeys.add(audio.audioKey);
          });
      }

      for (const key of Object.keys(sourceImages)) {
        if (audioKeys.has(key)) continue;
        const data = await extractImageData(sourceImages[key]);
        if (data) extractedImages[key] = data;
      }
      setLayerImages(extractedImages);

      // Extract Audio
      if (metadata.videoItem.audios && metadata.videoItem.audios.length > 0) {
          const audioObj = metadata.videoItem.audios[0];
          const audioKey = audioObj.audioKey;
          const rawAudio = sourceImages[audioKey];
          
          if (rawAudio) {
             let url = '';
             try {
                 if (typeof rawAudio === 'string') {
                     let binaryString = rawAudio;
                     if (rawAudio.startsWith('data:audio')) {
                         binaryString = atob(rawAudio.split(',')[1]);
                     } else if (rawAudio.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(rawAudio)) {
                         // Likely base64
                         try {
                             binaryString = atob(rawAudio);
                         } catch (e) {
                             // Not base64, treat as binary string
                             binaryString = rawAudio;
                         }
                     }
                     
                     const bytes = new Uint8Array(binaryString.length);
                     for (let i = 0; i < binaryString.length; i++) {
                         bytes[i] = binaryString.charCodeAt(i);
                     }
                     const blob = new Blob([bytes], { type: 'audio/mp3' });
                     url = URL.createObjectURL(blob);
                 } else if (rawAudio instanceof Uint8Array) {
                     const blob = new Blob([rawAudio], { type: 'audio/mp3' });
                     url = URL.createObjectURL(blob);
                 }
             } catch (e) {
                 console.error("Error extracting audio:", e);
             }
             
             if (url) {
                 setAudioUrl(url);
                 setOriginalAudioUrl(url);
             }
          }
      }

      setAssetsLoading(false);
    };
    fetchAssets();
  }, [metadata.videoItem, extractImageData]);

  useEffect(() => {
    let player: any = null;
    if (playerRef.current && metadata.videoItem && typeof SVGA !== 'undefined') {
      playerRef.current.innerHTML = '';
      player = new SVGA.Player(playerRef.current);
      player.loops = 0; player.clearsAfterStop = false;
      player.setContentMode('AspectFit'); 
      player.setVideoItem(metadata.videoItem);
      player.startAnimation();
      player.onFrame((frame: number) => setCurrentFrame(frame));
      setSvgaInstance(player);
      return () => { if (player) { player.stopAnimation(); player.clear(); } };
    }
  }, [metadata.videoItem]);

  const handlePlayToggle = () => {
    if (!svgaInstance) return;
    if (isPlaying) svgaInstance.pauseAnimation();
    else svgaInstance.startAnimation();
    setIsPlaying(!isPlaying);
  };

  const filteredKeys = useMemo(() => {
    return Object.keys(layerImages)
      .filter(key => key.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => parseInt(a.match(/\d+/)?.[0] || '0') - parseInt(b.match(/\d+/)?.[0] || '0'));
  }, [layerImages, searchQuery]);

  const handleReplaceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const base64 = ev.target?.result as string;
            if (replacingAssetKey) {
                setLayerImages(p => ({ ...p, [replacingAssetKey]: base64 }));
                const color = assetColors[replacingAssetKey];
                const finalImage = color ? await tintImage(base64, color) : base64;
                svgaInstance?.setImage(finalImage, replacingAssetKey);
                setReplacingAssetKey(null);
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const handleColorChange = async (key: string, color: string) => {
    setAssetColors(p => ({ ...p, [key]: color }));
    if (svgaInstance && !deletedKeys.has(key)) {
      const finalImage = await tintImage(layerImages[key], color);
      svgaInstance.setImage(finalImage, key);
    }
  };

  const handleDownloadLayer = (key: string) => {
    const base64 = layerImages[key];
    if (base64) {
      const link = document.createElement("a");
      link.href = base64;
      link.download = `${key}.png`;
      link.click();
    }
  };

  const handleDeleteAsset = (key: string) => {
    if (deletedKeys.has(key)) {
        setDeletedKeys(p => { const next = new Set(p); next.delete(key); return next; });
        if (svgaInstance) {
            const color = assetColors[key];
            if (color) tintImage(layerImages[key], color).then(tinted => svgaInstance.setImage(tinted, key));
            else svgaInstance.setImage(layerImages[key], key);
        }
    } else {
        setDeletedKeys(p => new Set(p).add(key));
        if (svgaInstance) svgaInstance.setImage(TRANSPARENT_PIXEL, key);
    }
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => { 
        setPreviewBg(ev.target?.result as string); setBgScale(100); setBgPos({ x: 50, y: 50 }); setActivePreset('custom');
      };
      reader.readAsDataURL(file);
    }
  };

  const selectPresetBg = (bg: PresetBackground | null) => {
    if (!bg) { setActivePreset('none'); setPreviewBg(null); }
    else { setActivePreset(bg.id); setPreviewBg(bg.url); setBgScale(100); setBgPos({ x: 50, y: 50 }); }
  };

  const handleWatermarkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => { setWatermark(ev.target?.result as string); setWmPos({ x: 0, y: 0 }); setWmScale(0.3); };
      reader.readAsDataURL(file);
    }
  };

  const getImageSize = (base64: string): Promise<{w: number, h: number}> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.src = base64;
    });
  };

  const handleAddLayer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const url = ev.target?.result as string;
        const size = await getImageSize(url);
        const newLayer: CustomLayer = {
          id: `layer_${Date.now()}`,
          name: file.name,
          url,
          x: (videoWidth - size.w) / 2,
          y: (videoHeight - size.h) / 2,
          scale: 1,
          width: size.w,
          height: size.h,
          zIndexMode: 'front'
        };
        setCustomLayers(prev => [...prev, newLayer]);
        setSelectedLayerId(newLayer.id);
        setActiveSideTab('transforms');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateLayer = (id: string, updates: Partial<CustomLayer>) => {
    setCustomLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const handleMoveLayer = (id: string, direction: 'up' | 'down') => {
    setCustomLayers(prev => {
      const index = prev.findIndex(l => l.id === id);
      if (index === -1) return prev;
      if (direction === 'up' && index < prev.length - 1) {
        const newArr = [...prev];
        [newArr[index], newArr[index + 1]] = [newArr[index + 1], newArr[index]];
        return newArr;
      }
      if (direction === 'down' && index > 0) {
        const newArr = [...prev];
        [newArr[index], newArr[index - 1]] = [newArr[index - 1], newArr[index]];
        return newArr;
      }
      return prev;
    });
  };

  const handleRemoveLayer = (id: string) => {
    if (confirm("حذف هذه الطبقة؟")) {
        setCustomLayers(prev => prev.filter(l => l.id !== id));
        if (selectedLayerId === id) setSelectedLayerId(null);
    }
  };

  const handleExportAEProject = async () => {
    if (!svgaInstance) return;
    const canProceed = await checkAndDeductCoins();
    if (!canProceed) return;

    setIsExporting(true);
    setExportPhase('تحليل مصفوفة الطبقات Quantum v5.6...');
    try {
      const zip = new JSZip();
      const assetsFolder = zip.folder("assets");
      const imagesMapping: Record<string, string> = {};
      const keys = Object.keys(layerImages);

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (deletedKeys.has(key)) continue;
        const processedBase64 = await getProcessedAsset(key);
        const fileName = `${key}.png`;
        assetsFolder.file(fileName, processedBase64.split(',')[1], { base64: true });
        imagesMapping[key] = fileName;
        setProgress(Math.floor((i / keys.length) * 30));
      }

      if (previewBg) zip.file(`background.png`, previewBg.split(',')[1], { base64: true });
      if (watermark) zip.file(`watermark.png`, watermark.split(',')[1], { base64: true });

      const sprites = (metadata.videoItem.sprites || []).filter((s: any) => !deletedKeys.has(s.imageKey));
      const manifest = {
        version: "5.6-QUANTUM-SYNC",
        width: videoWidth,
        height: videoHeight,
        fps: metadata.fps || 30,
        frames: metadata.frames || 0,
        adjustments: {
            svga: { pos: svgaPos, scale: svgaScale },
            bg: { pos: bgPos, scale: bgScale, exists: !!previewBg },
            wm: { pos: wmPos, scale: wmScale, exists: !!watermark }
        },
        sprites: sprites.map((s: any) => ({
          imageKey: s.imageKey,
          frames: s.frames.map((f: any) => ({
            a: f.alpha,
            l: f.layout,
            t: f.transform
          }))
        }))
      };

      const jsxContent = `
if (!this.JSON) { this.JSON = {}; }
(function () {
    'use strict';
    var cx = /[\\u0000\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]/g;
    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text) {
            var j; text = String(text); cx.lastIndex = 0;
            if (cx.test(text)) { text = text.replace(cx, function (a) { return '\\\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4); }); }
            j = eval('(' + text + ')'); return j;
        };
    }
}());

(function() {
    var data = ${JSON.stringify(manifest)};
    app.beginUndoGroup("Quantum SVGA Rebuild v5.6");
    var mainComp = app.project.items.addComp("Quantum_Animation_Suite", data.width, data.height, 1.0, data.frames / data.fps, data.fps);
    mainComp.bgColor = [0,0,0];
    var masterNull = mainComp.layers.addNull();
    masterNull.name = "GLOBAL_SVGA_TRANSFORM";
    masterNull.position.setValue([data.width/2 + data.adjustments.svga.pos.x, data.height/2 + data.adjustments.svga.pos.y]);
    masterNull.scale.setValue([data.adjustments.svga.scale * 100, data.adjustments.svga.scale * 100]);
    var assetsFolder = Folder.selectDialog("اختر مجلد assets المستخرج");
    if (!assetsFolder) { app.endUndoGroup(); return; }
    for (var i = 0; i < data.sprites.length; i++) {
        var sprite = data.sprites[i];
        var imgFile = File(assetsFolder.fsName + "/" + sprite.imageKey + ".png");
        if (!imgFile.exists) continue;
        var footage = app.project.importFile(new ImportOptions(imgFile));
        var layer = mainComp.layers.add(footage);
        layer.name = "Layer_" + i + "_" + sprite.imageKey;
        layer.parent = masterNull;
        layer.anchorPoint.setValue([footage.width/2, footage.height/2]);
        for (var f = 0; f < sprite.frames.length; f++) {
            var frame = sprite.frames[f];
            var time = f / data.fps;
            var centerX = footage.width / 2;
            var centerY = footage.height / 2;
            var finalX, finalY;
            var opKey = layer.opacity.addKey(time);
            layer.opacity.setValueAtKey(opKey, frame.a * 100);
            layer.opacity.setInterpolationTypeAtKey(opKey, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
            if (frame.t) {
                var t = frame.t;
                finalX = t.a * centerX + t.c * centerY + t.tx + frame.l.x;
                finalY = t.b * centerX + t.d * centerY + t.ty + frame.l.y;
                var sx = Math.sqrt(t.a * t.a + t.b * t.b) * 100;
                var sy = Math.sqrt(t.c * t.c + t.d * t.d) * 100;
                var rot = Math.atan2(t.b, t.a) * 180 / Math.PI;
                var scaleKey = layer.scale.addKey(time);
                layer.scale.setValueAtKey(scaleKey, [sx, sy]);
                layer.scale.setInterpolationTypeAtKey(scaleKey, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
                var rotKey = layer.rotation.addKey(time);
                layer.rotation.setValueAtKey(rotKey, rot);
                layer.rotation.setInterpolationTypeAtKey(rotKey, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
            } else {
                finalX = frame.l.x + centerX;
                finalY = frame.l.y + centerY;
                var scaleKey = layer.scale.addKey(time);
                layer.scale.setValueAtKey(scaleKey, [100, 100]);
                layer.scale.setInterpolationTypeAtKey(scaleKey, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
                var rotKey = layer.rotation.addKey(time);
                layer.rotation.setValueAtKey(rotKey, 0);
                layer.rotation.setInterpolationTypeAtKey(rotKey, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
            }
            var posKey = layer.position.addKey(time);
            layer.position.setValueAtKey(posKey, [finalX, finalY]);
            layer.position.setInterpolationTypeAtKey(posKey, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
        }
    }
    var projectFolder = assetsFolder.parent;
    if (data.adjustments.bg.exists) {
        var bgFile = File(projectFolder.fsName + "/background.png");
        if (bgFile.exists) {
            var bgL = mainComp.layers.add(app.project.importFile(new ImportOptions(bgFile)));
            bgL.name = "Quantum_Background";
            bgL.moveToEnd();
            bgL.scale.setValue([data.adjustments.bg.scale, data.adjustments.bg.scale]);
            bgL.position.setValue([data.width * (data.adjustments.bg.pos.x/100), data.height * (data.adjustments.bg.pos.y/100)]);
        }
    }
    if (data.adjustments.wm.exists) {
        var wmFile = File(projectFolder.fsName + "/watermark.png");
        if (wmFile.exists) {
            var wmL = mainComp.layers.add(app.project.importFile(new ImportOptions(wmFile)));
            wmL.name = "Quantum_Watermark";
            wmL.moveToBeginning();
            wmL.position.setValue([data.width/2 + data.adjustments.wm.pos.x, data.height/2 + data.adjustments.wm.pos.y]);
            var ws = data.adjustments.wm.scale * 100;
            wmL.scale.setValue([ws, ws]);
        }
    }
    app.endUndoGroup();
    alert("✅ اكتمل البناء الكمي v5.6!");
})();
      `;

      zip.file("build_animation.jsx", jsxContent);
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${metadata.name.replace('.svga','')}_PrecisionAE_v5.6.zip`;
      link.click();
      setProgress(100);
    } catch (e) { console.error(e); } finally { setTimeout(() => setIsExporting(false), 800); }
  };

  const handleExportImageSequence = async () => {
    if (!svgaInstance || !playerRef.current) return;
    const canProceed = await checkAndDeductCoins();
    if (!canProceed) return;

    setIsExporting(true);
    setExportPhase('جاري تصدير تسلسل الصور...');
    
    try {
      const zip = new JSZip();
      const folder = zip.folder("sequence");
      const totalFrames = metadata.frames || 0;
      
      svgaInstance.pauseAnimation();

      const canvas = playerRef.current.querySelector('canvas');
      if (!canvas) throw new Error("Canvas not found");

      const originalFrame = currentFrame;

      for (let i = 0; i < totalFrames; i++) {
        svgaInstance.stepToFrame(i, true);
        await new Promise(resolve => setTimeout(resolve, 20));
        
        const dataUrl = canvas.toDataURL("image/png");
        const base64 = dataUrl.split(',')[1];
        folder.file(`frame_${String(i).padStart(5, '0')}.png`, base64, { base64: true });
        
        setProgress(Math.floor(((i + 1) / totalFrames) * 100));
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${metadata.name.replace('.svga','')}_Sequence.zip`;
      link.click();
      
      svgaInstance.stepToFrame(originalFrame, true);
      
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء تصدير الصور");
    } finally {
      setIsExporting(false);
      if (isPlaying) svgaInstance.startAnimation();
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setAudioFile(file);
        const url = URL.createObjectURL(file);
        setAudioUrl(url);
        // Reset input value to allow re-uploading same file
        e.target.value = '';
    }
  };

  const handleMainExport = async () => {
    if (selectedFormat === 'AE Project') await handleExportAEProject();
    else if (selectedFormat === 'Image Sequence') await handleExportImageSequence();
    else if (selectedFormat === 'WebM (Transparent)') {
        const canProceed = await checkAndDeductCoins();
        if (!canProceed) return;

        setIsExporting(true);
        setExportPhase('جاري تسجيل فيديو WebM شفاف...');

        try {
            if (!svgaInstance || !playerRef.current) throw new Error("Player not ready");
            
            svgaInstance.pauseAnimation();
            const originalFrame = currentFrame;
            const totalFrames = metadata.frames || 0;
            const canvas = playerRef.current.querySelector('canvas');
            if (!canvas) throw new Error("Canvas not found");

            // Use MediaRecorder to record the canvas stream
            // VP9 codec supports alpha channel (transparency)
            const stream = canvas.captureStream(30); // 30 FPS
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
            const chunks: Blob[] = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${metadata.name.replace('.svga', '')}_Quantum.webm`; 
                a.click();
                
                // Restore state
                svgaInstance.stepToFrame(originalFrame, true);
                if (isPlaying) svgaInstance.startAnimation();
                setIsExporting(false);
                setProgress(0);
            };

            mediaRecorder.start();

            // Play through animation once to record
            const fps = metadata.fps || 30;
            const interval = 1000 / fps;

            for (let i = 0; i < totalFrames; i++) {
                svgaInstance.stepToFrame(i, true);
                await new Promise(r => setTimeout(r, interval)); 
                setProgress(Math.floor(((i + 1) / totalFrames) * 100));
            }
            
            mediaRecorder.stop();

        } catch (e) {
            console.error(e);
            alert("فشل تصدير الفيديو: " + (e as any).message);
            setIsExporting(false);
        }
    }
    else if (selectedFormat === 'VAP (MP4)') {
        const canProceed = await checkAndDeductCoins();
        if (!canProceed) return;

        setIsExporting(true);
        setExportPhase('جاري إنشاء فيديو VAP (Alpha+RGB)...');

        try {
            if (!svgaInstance || !playerRef.current) throw new Error("Player not ready");
            
            svgaInstance.pauseAnimation();
            const originalFrame = currentFrame;
            const totalFrames = metadata.frames || 0;
            const sourceCanvas = playerRef.current.querySelector('canvas');
            if (!sourceCanvas) throw new Error("Canvas not found");

            // VAP Format usually expects side-by-side or top-bottom layout.
            // Common is Left=Alpha, Right=RGB or Top=Alpha, Bottom=RGB.
            // Let's implement Side-by-Side: Left (Alpha), Right (RGB)
            // Total Width = videoWidth * 2
            
            const vapCanvas = document.createElement('canvas');
            vapCanvas.width = videoWidth * 2;
            vapCanvas.height = videoHeight;
            const vCtx = vapCanvas.getContext('2d');
            
            if (!vCtx) throw new Error("Failed to create VAP context");

            // Use MediaRecorder
            const stream = vapCanvas.captureStream(30);
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
            const chunks: Blob[] = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${metadata.name.replace('.svga', '')}_VAP.mp4`; // Naming as MP4 for compatibility, though container is WebM
                a.click();
                
                svgaInstance.stepToFrame(originalFrame, true);
                if (isPlaying) svgaInstance.startAnimation();
                setIsExporting(false);
                setProgress(0);
            };

            mediaRecorder.start();

            const fps = metadata.fps || 30;
            const interval = 1000 / fps;

            for (let i = 0; i < totalFrames; i++) {
                svgaInstance.stepToFrame(i, true);
                await new Promise(r => setTimeout(r, interval));

                // Clear
                vCtx.clearRect(0, 0, vapCanvas.width, vapCanvas.height);

                // 1. Draw RGB on the RIGHT side
                // We need to draw it on a black background to ensure colors are correct?
                // Or just draw it.
                vCtx.drawImage(sourceCanvas, videoWidth, 0);

                // 2. Draw Alpha on the LEFT side
                // To extract alpha, we can draw the image, then manipulate pixels.
                // Or use composite operations.
                // Draw image to temp canvas
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = videoWidth;
                tempCanvas.height = videoHeight;
                const tCtx = tempCanvas.getContext('2d');
                if (tCtx) {
                    tCtx.drawImage(sourceCanvas, 0, 0);
                    const imageData = tCtx.getImageData(0, 0, videoWidth, videoHeight);
                    const data = imageData.data;
                    
                    // Convert to Grayscale based on Alpha
                    for (let j = 0; j < data.length; j += 4) {
                        const alpha = data[j + 3];
                        data[j] = alpha;     // R
                        data[j + 1] = alpha; // G
                        data[j + 2] = alpha; // B
                        data[j + 3] = 255;   // Alpha is full opaque
                    }
                    tCtx.putImageData(imageData, 0, 0);
                    
                    // Draw Alpha Mask to Left Side
                    vCtx.drawImage(tempCanvas, 0, 0);
                }

                setProgress(Math.floor(((i + 1) / totalFrames) * 100));
            }
            
            mediaRecorder.stop();

        } catch (e) {
            console.error(e);
            alert("فشل تصدير VAP: " + (e as any).message);
            setIsExporting(false);
        }
    }
    else if (selectedFormat === 'WebP Image') {
        const canProceed = await checkAndDeductCoins();
        if (!canProceed) return;

        setIsExporting(true);
        setExportPhase('جاري حفظ صورة WebP...');

        try {
            if (!svgaInstance || !playerRef.current) throw new Error("Player not ready");
            
            svgaInstance.pauseAnimation();
            const canvas = playerRef.current.querySelector('canvas');
            if (!canvas) throw new Error("Canvas not found");

            // Capture current frame as WebP
            // Note: This captures the CURRENTLY VISIBLE frame
            const dataUrl = canvas.toDataURL('image/webp', 0.9);
            
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `${metadata.name.replace('.svga', '')}_Frame${currentFrame}.webp`;
            a.click();
            
            setIsExporting(false);
            setProgress(100);
            setTimeout(() => setProgress(0), 1000);

        } catch (e) {
            console.error(e);
            alert("فشل حفظ الصورة");
            setIsExporting(false);
        }
    }
    else if (selectedFormat === 'SVGA 2.0' && typeof protobuf !== 'undefined') {

        const isEdgeFadeActive = fadeConfig.top > 0 || fadeConfig.bottom > 0 || fadeConfig.left > 0 || fadeConfig.right > 0;

        setIsExporting(true); 
        setExportPhase(isEdgeFadeActive ? 'جاري دمج الشفافية مع الإطارات...' : 'جاري ضغط الصور وإعادة بناء ملف SVGA...');
        
        try {
            const root = protobuf.parse(`syntax="proto3";package com.opensource.svga;message MovieParams{float viewBoxWidth=1;float viewBoxHeight=2;int32 fps=3;int32 frames=4;}message Transform{float a=1;float b=2;float c=3;float d=4;float tx=5;float ty=6;}message Layout{float x=1;float y=2;float width=3;float height=4;}message ShapeEntity{int32 type=1;map<string,float> args=2;map<string,string> styles=3;Transform transform=4;}message FrameEntity{float alpha=1;Layout layout=2;Transform transform=3;string clipPath=4;repeated ShapeEntity shapes=5;string blendMode=6;}message AudioEntity{string audioKey=1;int32 startFrame=2;int32 endFrame=3;int32 startTime=4;int32 totalTime=5;}message MovieEntity{string version=1;MovieParams params=2;map<string, bytes> images=3;repeated SpriteEntity sprites=4;repeated AudioEntity audios=5;}message SpriteEntity{string imageKey=1;repeated FrameEntity frames=2;string matteKey=3;}`).root;
            const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
            
            const imagesData: Record<string, Uint8Array> = {};
            const audioList: any[] = [...(metadata.videoItem.audios || [])];
            
            // 1. Clone original sprites to preserve ALL properties (lossless structure)
            // Filter out sprites whose imageKeys are in the deletedKeys set
            let finalSprites = (metadata.videoItem.sprites || []).filter((s: any) => !deletedKeys.has(s.imageKey)).map((s: any) => {
                // Deep copy sprite to avoid mutating original
                return JSON.parse(JSON.stringify(s));
            });

            // ---------------------------------------------------------
            // SCENARIO A: EDGE FADE ACTIVE -> BAKE TO FRAME SEQUENCE
            // ---------------------------------------------------------
            if (isEdgeFadeActive) {
                if (!svgaInstance || !playerRef.current) throw new Error("Player not ready");
                
                svgaInstance.pauseAnimation();
                const originalFrame = currentFrame;
                const totalFrames = metadata.frames || 0;
                const canvas = playerRef.current.querySelector('canvas');
                if (!canvas) throw new Error("Canvas not found");

                // Prepare Fade Mask Canvas (Reusable)
                const maskCanvas = document.createElement('canvas');
                // STRICTLY USE ORIGINAL DIMENSIONS
                maskCanvas.width = videoWidth;
                maskCanvas.height = videoHeight;
                const mCtx = maskCanvas.getContext('2d');
                
                // Clear existing sprites to rebuild as a sequence
                finalSprites = []; 
                
                for (let i = 0; i < totalFrames; i++) {
                    svgaInstance.stepToFrame(i, true);
                    await new Promise(resolve => setTimeout(resolve, 50));

                    if (mCtx) {
                        mCtx.globalCompositeOperation = 'source-over';
                        mCtx.clearRect(0, 0, videoWidth, videoHeight);
                        // Draw the player canvas exactly at 0,0 with original dimensions
                        mCtx.drawImage(canvas, 0, 0, videoWidth, videoHeight);

                        // Apply Fade (Destination Out)
                        mCtx.globalCompositeOperation = 'destination-out';
                        
                        if (fadeConfig.left > 0) {
                            const w = videoWidth * (fadeConfig.left / 100);
                            const g = mCtx.createLinearGradient(0, 0, w, 0);
                            g.addColorStop(0, 'rgba(0,0,0,1)');
                            g.addColorStop(1, 'rgba(0,0,0,0)');
                            mCtx.fillStyle = g;
                            mCtx.fillRect(0, 0, w, videoHeight);
                        }
                        if (fadeConfig.right > 0) {
                            const w = videoWidth * (fadeConfig.right / 100);
                            const g = mCtx.createLinearGradient(videoWidth, 0, videoWidth - w, 0);
                            g.addColorStop(0, 'rgba(0,0,0,1)');
                            g.addColorStop(1, 'rgba(0,0,0,0)');
                            mCtx.fillStyle = g;
                            mCtx.fillRect(videoWidth - w, 0, w, videoHeight);
                        }
                        if (fadeConfig.top > 0) {
                            const h = videoHeight * (fadeConfig.top / 100);
                            const g = mCtx.createLinearGradient(0, 0, 0, h);
                            g.addColorStop(0, 'rgba(0,0,0,1)');
                            g.addColorStop(1, 'rgba(0,0,0,0)');
                            mCtx.fillStyle = g;
                            mCtx.fillRect(0, 0, videoWidth, h);
                        }
                        if (fadeConfig.bottom > 0) {
                            const h = videoHeight * (fadeConfig.bottom / 100);
                            const g = mCtx.createLinearGradient(0, videoHeight, 0, videoHeight - h);
                            g.addColorStop(0, 'rgba(0,0,0,1)');
                            g.addColorStop(1, 'rgba(0,0,0,0)');
                            mCtx.fillStyle = g;
                            mCtx.fillRect(0, videoHeight - h, videoWidth, h);
                        }

                        // Extract Data
                        let dataUrl = maskCanvas.toDataURL('image/png');
                        
                        // Apply Compression (Resize Asset Only)
                        if (exportScale < 1.0) {
                            const tempCanvas = document.createElement('canvas');
                            // Resize the ASSET bitmap
                            tempCanvas.width = Math.floor(videoWidth * exportScale);
                            tempCanvas.height = Math.floor(videoHeight * exportScale);
                            const tCtx = tempCanvas.getContext('2d');
                            if (tCtx) {
                                tCtx.drawImage(maskCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
                                dataUrl = tempCanvas.toDataURL('image/png');
                            }
                        }

                        const binary = atob(dataUrl.split(',')[1]);
                        const bytes = new Uint8Array(binary.length);
                        for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                        
                        const key = `f_${i}`;
                        imagesData[key] = bytes;

                        // Create Sprite for this frame
                        // IMPORTANT: Layout MUST remain original videoWidth/videoHeight
                        // The player will stretch the compressed asset to fill this layout
                        const spriteFrames = [];
                        for (let f = 0; f < totalFrames; f++) {
                            spriteFrames.push({
                                alpha: f === i ? 1.0 : 0.0,
                                layout: { x: 0, y: 0, width: videoWidth, height: videoHeight },
                                transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                            });
                        }
                        finalSprites.push({
                            imageKey: key,
                            frames: spriteFrames
                        });
                    }
                    setProgress(Math.floor(((i + 1) / totalFrames) * 100));
                }

                // Restore original state
                svgaInstance.stepToFrame(originalFrame, true);
                if (isPlaying) svgaInstance.startAnimation();

            } 
            // ---------------------------------------------------------
            // SCENARIO B: STANDARD EXPORT (NO FADE) - PRESERVE LAYOUT
            // ---------------------------------------------------------
            else {
                const keys = Object.keys(layerImages);
                
                // 1. Extract & Compress Images
                for (let i = 0; i < keys.length; i++) {
                    const key = keys[i];
                    if (deletedKeys.has(key)) continue;

                    const b64 = await getProcessedAsset(key);
                    let binaryString = atob(b64.split(',')[1]);
                    
                    // Apply Compression (Resize Asset Only)
                    // ONLY resize if exportScale is significantly smaller (< 0.9)
                    // This prevents "Fake Sizes" or quality loss when user wants 100% quality
                    if (exportScale < 0.9) {
                        const img = new Image();
                        img.src = b64;
                        await new Promise(r => img.onload = r);
                        
                        const canvas = document.createElement('canvas');
                        // Scale the BITMAP dimensions
                        canvas.width = Math.floor(img.width * exportScale);
                        canvas.height = Math.floor(img.height * exportScale);
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                            const resizedDataUrl = canvas.toDataURL('image/png');
                            binaryString = atob(resizedDataUrl.split(',')[1]);
                        }
                    }

                    const bytes = new Uint8Array(binaryString.length);
                    for (let j = 0; j < binaryString.length; j++) bytes[j] = binaryString.charCodeAt(j);
                    imagesData[key] = bytes;
                }

                // 2. Watermark
                const wmKey = "quantum_wm_layer_fixed";
                if (watermark) {
                    const binary = atob(watermark.split(',')[1]);
                    const bytes = new Uint8Array(binary.length);
                    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                    imagesData[wmKey] = bytes;
                }

                // 3. Process Sprites (Preserve Original Layouts)
                // We already cloned `finalSprites` from `metadata.videoItem.sprites` at the start.
                // Since we only resized the images in `imagesData`, and kept the `layout` in `finalSprites` intact,
                // the animation dimensions will be preserved perfectly.
                
                // Add Watermark Sprite
                if (watermark) {
                    const wmSize = await getImageSize(watermark);
                    const wmWidth = videoWidth * wmScale;
                    const wmHeight = wmWidth * (wmSize.h / wmSize.w);
                    const wmX = (videoWidth / 2) - (wmWidth / 2) + wmPos.x;
                    const wmY = (videoHeight / 2) - (wmHeight / 2) + wmPos.y;
                    
                    const wmFrame = {
                        alpha: 1.0,
                        layout: { x: wmX || 0, y: wmY || 0, width: wmWidth, height: wmHeight },
                        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                    };
                    finalSprites.push({
                        imageKey: wmKey,
                        frames: Array(metadata.frames || 1).fill(wmFrame)
                    });
                }

                // Add Custom Layers
                // Back Layers
                const backLayers = customLayers.filter(l => l.zIndexMode === 'back');
                for (const layer of backLayers) {
                    const layerKey = layer.id;
                    const binary = atob(layer.url.split(',')[1]);
                    const bytes = new Uint8Array(binary.length);
                    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                    imagesData[layerKey] = bytes;

                    const finalWidth = layer.width * layer.scale;
                    const finalHeight = layer.height * layer.scale;
                    const layerFrame = {
                        alpha: 1.0,
                        layout: { x: layer.x, y: layer.y, width: finalWidth, height: finalHeight },
                        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                    };
                    finalSprites.unshift({ imageKey: layerKey, frames: Array(metadata.frames || 1).fill(layerFrame) });
                }

                // Front Layers
                const frontLayers = customLayers.filter(l => l.zIndexMode === 'front');
                for (const layer of frontLayers) {
                    const layerKey = layer.id;
                    const binary = atob(layer.url.split(',')[1]);
                    const bytes = new Uint8Array(binary.length);
                    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                    imagesData[layerKey] = bytes;

                    const finalWidth = layer.width * layer.scale;
                    const finalHeight = layer.height * layer.scale;
                    const layerFrame = {
                        alpha: 1.0,
                        layout: { x: layer.x, y: layer.y, width: finalWidth, height: finalHeight },
                        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                    };
                    finalSprites.push({ imageKey: layerKey, frames: Array(metadata.frames || 1).fill(layerFrame) });
                }
            }

            // ---------------------------------------------------------
            // AUDIO HANDLING
            // ---------------------------------------------------------
            if (audioUrl) {
                const audioKey = "quantum_audio_track";
                let bytes: Uint8Array | null = null;
                
                // If user uploaded a new audio file, use it
                if (audioFile) {
                    const arrayBuffer = await audioFile.arrayBuffer();
                    bytes = new Uint8Array(arrayBuffer);
                } 
                // If it's the original audio from SVGA/MP4 and hasn't been changed
                else if (audioUrl === originalAudioUrl) {
                     // If it's in the original imagesData (extracted from SVGA), we might need to find its key
                     // But here we are rebuilding. If originalAudioUrl is set, we might have extracted it.
                     // If we want to KEEP original audio without re-encoding, we should ensure it's in imagesData.
                     // However, for MP4 uploads, audioUrl is a blob URL.
                     try {
                        const response = await fetch(audioUrl);
                        const arrayBuffer = await response.arrayBuffer();
                        bytes = new Uint8Array(arrayBuffer);
                     } catch (e) { console.error("Failed to fetch audio blob", e); }
                }
                // If it's a new audio URL (e.g. from video)
                else {
                    try {
                        const response = await fetch(audioUrl);
                        const arrayBuffer = await response.arrayBuffer();
                        bytes = new Uint8Array(arrayBuffer);
                    } catch (e) { console.error("Failed to fetch audio", e); }
                }

                if (bytes) {
                    imagesData[audioKey] = bytes; 
                    // Remove existing audios if we are replacing
                    // Or append? Usually one audio track is preferred.
                    // Let's replace to be safe if we are "setting" audio.
                    // But if we want to preserve original audios and just ADD, we should check.
                    // For now, let's assume we replace if audioUrl is active.
                    
                    // Clear existing audios list if we are providing a main track
                    audioList.length = 0; 
                    audioList.push({
                        audioKey: audioKey,
                        startFrame: 0,
                        endFrame: metadata.frames || 0,
                        startTime: 0,
                        totalTime: 0 
                    });
                }
            }

            // ---------------------------------------------------------
            // CONSTRUCT PAYLOAD
            // ---------------------------------------------------------
            const payload = { 
                version: "2.0", 
                params: { 
                    viewBoxWidth: videoWidth, 
                    viewBoxHeight: videoHeight, 
                    fps: metadata.fps || 30, 
                    frames: metadata.frames || 0 
                }, 
                images: imagesData, 
                sprites: finalSprites,
                audios: audioList
            };

            const buffer = MovieEntity.encode(MovieEntity.create(payload)).finish();
            const compressedBuffer = pako.deflate(buffer);
            
            const link = document.createElement("a");
            link.href = URL.createObjectURL(new Blob([compressedBuffer]));
            link.download = `${metadata.name.replace('.svga','')}_Quantum_${Math.round(exportScale*100)}.svga`;
            link.click();
            setProgress(100);
        } catch (e) {
            console.error(e);
            alert("فشل التصدير: " + (e as any).message);
        } finally { 
            setTimeout(() => setIsExporting(false), 800); 
        }
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8 pb-32 animate-in fade-in slide-in-from-bottom-8 duration-1000 font-arabic select-none text-right" dir="rtl">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleReplaceImage} />
      <input type="file" ref={bgInputRef} className="hidden" accept="image/*" onChange={handleBgUpload} />
      <input type="file" ref={watermarkInputRef} className="hidden" accept="image/*" onChange={handleWatermarkUpload} />
      <input type="file" ref={layerInputRef} className="hidden" accept="image/*" onChange={handleAddLayer} />
      <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={handleAudioUpload} />
      <input type="file" ref={videoInputRef} className="hidden" accept="video/mp4" onChange={handleVideoUpload} />
      <audio ref={audioRef} src={audioUrl || undefined} loop />

      {isExporting && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-3xl flex items-center justify-center p-6">
           <div className="max-w-md w-full bg-slate-900 border border-white/10 p-10 rounded-[3rem] shadow-3xl text-center space-y-6">
              <div className="w-24 h-24 bg-sky-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-sky-500/20">
                 <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h3 className="text-white font-black text-xl uppercase tracking-tighter">{exportPhase}</h3>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                 <div className="h-full bg-sky-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
           </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between p-6 sm:p-10 rounded-[3rem] border border-white/5 gap-6 shadow-2xl bg-slate-900/40 backdrop-blur-3xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-transparent via-sky-500/30 to-transparent"></div>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 text-center sm:text-right">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-sky-400 to-indigo-600 rounded-[2rem] flex items-center justify-center text-white shadow-glow-sky text-3xl">
             <span className="drop-shadow-lg animate-pulse">⚛️</span>
          </div>
          <div>
            <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight mb-1">{metadata.name}</h2>
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 sm:gap-4">
               <span className="px-3 py-1 bg-sky-500/10 text-sky-400 text-[10px] font-black rounded-lg border border-sky-500/20 uppercase tracking-[0.2em]">{videoWidth}X{videoHeight}</span>
               <span className="text-[10px] sm:text-[12px] text-slate-500 font-bold uppercase tracking-[0.3em]">{metadata.frames} إطارات</span>
            </div>
          </div>
        </div>
        <button onClick={onCancel} className="w-full sm:w-auto px-10 py-5 bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-[2rem] border border-white/10 transition-all font-black uppercase text-[10px] tracking-widest active:scale-95">إلغاء المعالجة</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8 overflow-visible">
        <div className="xl:col-span-7 flex flex-col gap-0 overflow-visible">
          <div className="relative flex items-center justify-center w-full overflow-hidden rounded-[3rem] border border-white/10 shadow-3xl bg-black/20" style={{ height: `${videoHeight * scale}px` }}>
              <div ref={containerRef} className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out origin-center pointer-events-none" style={{ transform: `scale(${scale})` }}>
                  <div className="relative overflow-hidden shadow-2xl bg-slate-950 pointer-events-auto" style={{ 
                      width: `${videoWidth}px`, 
                      height: `${videoHeight}px`, 
                      backgroundImage: previewBg ? `url(${previewBg})` : 'none', 
                      backgroundSize: `${bgScale}%`, 
                      backgroundRepeat: 'no-repeat', 
                      backgroundPosition: `${bgPos.x}% ${bgPos.y}%`, 
                      boxShadow: '0 0 100px rgba(0,0,0,0.5), inset 0 0 50px rgba(0,0,0,0.5)', 
                      border: previewBg ? 'none' : '2px solid rgba(255,255,255,0.05)',
                      maskImage: (fadeConfig.top > 0 || fadeConfig.bottom > 0 || fadeConfig.left > 0 || fadeConfig.right > 0) ? `
                        linear-gradient(to right, transparent, black ${fadeConfig.left}%, black ${100-fadeConfig.right}%, transparent), 
                        linear-gradient(to bottom, transparent, black ${fadeConfig.top}%, black ${100-fadeConfig.bottom}%, transparent)
                      ` : 'none',
                      maskComposite: 'intersect'
                  }}>
                      {/* Back Layers */}
                      {customLayers.filter(l => l.zIndexMode === 'back').map(layer => (
                        <div 
                            key={layer.id}
                            className="absolute z-[5] pointer-events-none transition-transform duration-200"
                            style={{ 
                                left: 0, 
                                top: 0, 
                                transform: `translate(${layer.x}px, ${layer.y}px)`,
                                width: layer.width * layer.scale,
                                height: layer.height * layer.scale
                            }}
                        >
                            <img 
                                src={layer.url} 
                                className={`w-full h-full pointer-events-auto cursor-pointer ${selectedLayerId === layer.id ? 'ring-2 ring-sky-500 shadow-glow-sky' : ''}`}
                                onClick={(e) => { e.stopPropagation(); setSelectedLayerId(layer.id); setActiveSideTab('transforms'); }}
                            />
                        </div>
                      ))}

                      <div className="w-full h-full relative z-10 flex items-center justify-center transition-transform duration-300" style={{ transform: `translate(${svgaPos.x}px, ${svgaPos.y}px) scale(${svgaScale})` }}>
                         <div ref={playerRef} id="svga-player-container" className="w-full h-full relative flex items-center justify-center overflow-visible"></div>
                      </div>
                      {watermark && (
                        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center p-0 transition-transform duration-200" style={{ transform: `translate(${wmPos.x}px, ${wmPos.y}px)` }}>
                           <img src={watermark} className="object-contain filter drop-shadow-2xl opacity-70" style={{ width: `${wmScale * 100}%` }} alt="Watermark" />
                        </div>
                      )}
                      {/* Front Layers */}
                      {customLayers.filter(l => l.zIndexMode === 'front').map(layer => (
                        <div 
                            key={layer.id}
                            className="absolute z-25 pointer-events-none transition-transform duration-200"
                            style={{ 
                                left: 0, 
                                top: 0, 
                                transform: `translate(${layer.x}px, ${layer.y}px)`,
                                width: layer.width * layer.scale,
                                height: layer.height * layer.scale
                            }}
                        >
                            <img 
                                src={layer.url} 
                                className={`w-full h-full pointer-events-auto cursor-pointer ${selectedLayerId === layer.id ? 'ring-2 ring-sky-500 shadow-glow-sky' : ''}`}
                                onClick={(e) => { e.stopPropagation(); setSelectedLayerId(layer.id); setActiveSideTab('transforms'); }}
                            />
                        </div>
                      ))}
                  </div>
              </div>
          </div>

          <div className="mt-4 w-full bg-slate-950/60 backdrop-blur-3xl p-6 sm:p-8 rounded-[2.5rem] border border-white/5 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 shadow-2xl relative z-20">
               <button onClick={handlePlayToggle} className="w-16 h-16 bg-sky-500 hover:bg-sky-400 text-white rounded-2xl flex items-center justify-center shadow-glow-sky transition-all active:scale-90">
                 {isPlaying ? <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z"/></svg> : <svg className="w-8 h-8 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M4.5 3.5l11 6.5-11 6.5z"/></svg>}
               </button>
               <div className="flex-1 w-full flex flex-col gap-3">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-white font-black text-xs px-3 py-1 bg-white/5 rounded-lg border border-white/5">{currentFrame} / {metadata.frames}</span>
                    <span className="text-slate-600 text-[9px] font-black uppercase tracking-widest">إطار المشهد</span>
                  </div>
                  <div className="relative h-2 flex items-center">
                    <div className="absolute inset-0 h-1 bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-sky-500" style={{ width: `${(currentFrame / (metadata.frames || 1)) * 100}%` }}></div>
                    </div>
                    <input type="range" min="0" max={metadata.frames || 1} value={currentFrame} onChange={(e) => { const f = parseInt(e.target.value); svgaInstance?.stepToFrame(f, false); setCurrentFrame(f); }} className="absolute inset-0 w-full h-full appearance-none bg-transparent accent-sky-500 cursor-pointer z-10" />
                  </div>
               </div>
          </div>
        </div>

        <div className="xl:col-span-5 flex flex-col gap-6 h-auto xl:h-[800px]">
          <div className="flex bg-slate-950/80 p-1 rounded-3xl border border-white/5">
              <button onClick={() => setActiveSideTab('layers')} className={`flex-1 py-3 rounded-2xl text-[9px] font-black uppercase transition-all ${activeSideTab === 'layers' ? 'bg-sky-500 text-white shadow-glow-sky' : 'text-slate-500'}`}>الطبقات</button>
              <button onClick={() => setActiveSideTab('transforms')} className={`flex-1 py-3 rounded-2xl text-[9px] font-black uppercase transition-all ${activeSideTab === 'transforms' ? 'bg-sky-500 text-white shadow-glow-sky' : 'text-slate-500'}`}>التحويلات</button>
              <button onClick={() => setActiveSideTab('bg')} className={`flex-1 py-3 rounded-2xl text-[9px] font-black uppercase transition-all ${activeSideTab === 'bg' ? 'bg-sky-500 text-white shadow-glow-sky' : 'text-slate-500'}`}>الخلفية</button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950/80 rounded-[3rem] p-6 border border-white/5 shadow-3xl">
              {activeSideTab === 'layers' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-white font-black text-xl uppercase">إدارة الطبقات Quantum</h3>
                        <button onClick={() => layerInputRef.current?.click()} className="px-4 py-2 bg-sky-500 text-white rounded-xl text-[10px] font-black uppercase shadow-glow-sky">+ إضافة طبقة</button>
                    </div>
                    
                    {customLayers.length > 0 && (
                        <div className="mb-6 space-y-3 pb-6 border-b border-white/5">
                            <h4 className="text-sky-400 font-black text-xs uppercase tracking-widest mb-3">طبقات مضافة ({customLayers.length})</h4>
                            <div className="grid grid-cols-2 gap-4">
                                {[...customLayers].reverse().map(layer => (
                                    <div key={layer.id} onClick={() => { setSelectedLayerId(layer.id); setActiveSideTab('transforms'); }} className={`group bg-slate-900/30 rounded-[2rem] border p-4 transition-all cursor-pointer ${selectedLayerId === layer.id ? 'border-sky-500 bg-sky-500/10' : 'border-white/[0.03]'}`}>
                                        <div className="aspect-square rounded-2xl bg-black/40 flex items-center justify-center relative overflow-hidden mb-2">
                                            <img src={layer.url} className="max-w-[80%] max-h-[80%] object-contain" />
                                        </div>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[8px] text-white font-black truncate max-w-[80px]">{layer.name}</span>
                                            <button onClick={(e) => { e.stopPropagation(); handleRemoveLayer(layer.id); }} className="text-red-500 hover:text-red-400">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                                            </button>
                                        </div>
                                        <div className="flex gap-1 justify-between">
                                            <button onClick={(e) => { e.stopPropagation(); handleMoveLayer(layer.id, 'down'); }} className="px-2 py-1 bg-white/5 rounded text-[8px] text-slate-400 hover:text-white">⬇️</button>
                                            <button onClick={(e) => { e.stopPropagation(); handleUpdateLayer(layer.id, { zIndexMode: layer.zIndexMode === 'front' ? 'back' : 'front' }); }} className={`px-2 py-1 rounded text-[8px] font-black uppercase ${layer.zIndexMode === 'front' ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-700 text-slate-400'}`}>{layer.zIndexMode === 'front' ? 'أمام' : 'خلف'}</button>
                                            <button onClick={(e) => { e.stopPropagation(); handleMoveLayer(layer.id, 'up'); }} className="px-2 py-1 bg-white/5 rounded text-[8px] text-slate-400 hover:text-white">⬆️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        {filteredKeys.map(key => (
                            <div key={key} className={`group bg-slate-900/30 rounded-[2rem] border p-4 transition-all duration-300 relative ${deletedKeys.has(key) ? 'border-red-500/50 grayscale opacity-40' : 'border-white/[0.03]'}`}>
                                <div className="aspect-square rounded-2xl bg-black/40 flex items-center justify-center relative overflow-hidden">
                                   {layerImages[key] && <img src={layerImages[key]} className="max-w-[70%] max-h-[70%] object-contain" style={{ filter: assetColors[key] ? `drop-shadow(0 0 2px ${assetColors[key]})` : 'none' }} />}
                                   <div className="absolute inset-0 bg-slate-950/90 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 backdrop-blur-md px-2">
                                      {!deletedKeys.has(key) && (
                                          <div className="flex gap-2">
                                            <button onClick={() => { setReplacingAssetKey(key); fileInputRef.current?.click(); }} className="w-8 h-8 bg-sky-500 text-white rounded-lg flex items-center justify-center">✏️</button>
                                            <button onClick={() => handleDownloadLayer(key)} className="w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center">⬇️</button>
                                            <div className="relative w-8 h-8 bg-white/10 rounded-lg overflow-hidden border border-white/20">
                                              <input type="color" value={assetColors[key] || "#ffffff"} onChange={(e) => handleColorChange(key, e.target.value)} className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer bg-transparent border-none" />
                                            </div>
                                          </div>
                                      )}
                                      <button onClick={() => handleDeleteAsset(key)} className={`w-full py-1.5 ${deletedKeys.has(key) ? 'bg-emerald-500' : 'bg-red-500'} text-white rounded-lg text-[8px] font-black uppercase`}>{deletedKeys.has(key) ? 'استعادة' : 'حذف'}</button>
                                   </div>
                                </div>
                                <span className="mt-2 text-[8px] text-slate-500 font-black block text-center uppercase truncate">{key}</span>
                            </div>
                        ))}
                    </div>
                </div>
              )}

              {activeSideTab === 'transforms' && (
                <div className="space-y-10 animate-in slide-in-from-right-4 duration-300">
                    {selectedLayerId && customLayers.find(l => l.id === selectedLayerId) && (
                        <div className="space-y-6 pb-6 border-b border-white/5">
                            <div className="flex justify-between items-center">
                                <h4 className="text-white font-black text-xs uppercase tracking-widest text-sky-400">تحويلات الطبقة المحددة</h4>
                                <button onClick={() => setSelectedLayerId(null)} className="text-[9px] text-slate-500 hover:text-white">إلغاء التحديد</button>
                            </div>
                            <div className="space-y-4">
                               {(() => {
                                   const l = customLayers.find(l => l.id === selectedLayerId)!;
                                   return (
                                       <>
                                    <TransformControl label="الموضع الأفقي (X)" value={l.x} min={-videoWidth} max={videoWidth} onChange={v => handleUpdateLayer(l.id, { x: v })} />
                                           <TransformControl label="الموضع الرأسي (Y)" value={l.y} min={-videoHeight} max={videoHeight} onChange={v => handleUpdateLayer(l.id, { y: v })} />
                                           <TransformControl label="العرض (Width)" value={l.width} min={1} max={videoWidth * 2} onChange={v => handleUpdateLayer(l.id, { width: v })} />
                                           <TransformControl label="الارتفاع (Height)" value={l.height} min={1} max={videoHeight * 2} onChange={v => handleUpdateLayer(l.id, { height: v })} />
                                           <TransformControl label="مقياس الحجم (Scale)" value={l.scale} min={0.1} max={3} step={0.01} onChange={v => handleUpdateLayer(l.id, { scale: v })} />
                                       </>
                                   );
                               })()}
                            </div>
                        </div>
                    )}

                    <div className="space-y-6">
                        <h4 className="text-white font-black text-xs uppercase tracking-widest text-sky-400">تحويلات الهدية (SVGA)</h4>
                        <div className="space-y-4">
                           <TransformControl label="الموضع الأفقي (X)" value={svgaPos.x} min={-500} max={500} onChange={v => setSvgaPos(p => ({ ...p, x: v }))} />
                           <TransformControl label="الموضع الرأسي (Y)" value={svgaPos.y} min={-800} max={800} onChange={v => setSvgaPos(p => ({ ...p, y: v }))} />
                           <TransformControl label="مقياس الحجم" value={svgaScale} min={0.1} max={3} step={0.01} onChange={v => setSvgaScale(v)} />
                        </div>
                    </div>

                    <div className="space-y-6 pt-6 border-t border-white/5">
                        <h4 className="text-white font-black text-xs uppercase tracking-widest text-indigo-400">تحويلات العلامة المائية</h4>
                        <div className="space-y-4">
                           <TransformControl label="الموضع الأفقي (X)" value={wmPos.x} min={-500} max={500} onChange={v => setWmPos(p => ({ ...p, x: v }))} />
                           <TransformControl label="الموضع الرأسي (Y)" value={wmPos.y} min={-800} max={800} onChange={v => setWmPos(p => ({ ...p, y: v }))} />
                           <TransformControl label="الحجم" value={wmScale} min={0.05} max={1} step={0.01} onChange={v => setWmScale(v)} />
                        </div>
                    </div>

                    <div className="space-y-6 pt-6 border-t border-white/5">
                        <h4 className="text-white font-black text-xs uppercase tracking-widest text-emerald-400">تحويلات الخلفية</h4>
                        <div className="space-y-4">
                           <TransformControl label="تكبير الخلفية" value={bgScale} min={100} max={300} onChange={v => setBgScale(v)} />
                           <TransformControl label="الموضع X" value={bgPos.x} min={0} max={100} onChange={v => setBgPos(p => ({ ...p, x: v }))} />
                           <TransformControl label="الموضع Y" value={bgPos.y} min={0} max={100} onChange={v => setBgPos(p => ({ ...p, y: v }))} />
                        </div>
                    </div>
                </div>
              )}

              {activeSideTab === 'bg' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 gap-4">
                       <button onClick={() => bgInputRef.current?.click()} className="py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] text-white font-black uppercase">رفع خلفية</button>
                       <button onClick={() => watermarkInputRef.current?.click()} className="py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] text-white font-black uppercase">رفع علامة</button>
                       <button onClick={() => audioInputRef.current?.click()} className={`py-4 border border-white/5 rounded-2xl text-[10px] font-black uppercase ${audioUrl ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-white'}`}>{audioUrl ? 'تغيير الصوت' : 'رفع صوت'}</button>
                       <button onClick={() => videoInputRef.current?.click()} className="py-4 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl text-[10px] font-black uppercase">تحويل MP4</button>
                       {originalAudioUrl && (
                           <button onClick={() => { const link = document.createElement('a'); link.href = originalAudioUrl; link.download = `${metadata.name.replace('.svga', '')}_audio.mp3`; link.click(); }} className="py-4 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl text-[10px] font-black uppercase">تنزيل الصوت الأصلي</button>
                       )}
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <h4 className="text-white font-black text-xs uppercase tracking-widest text-emerald-400 mb-2">جودة التصدير (حجم الملف)</h4>
                        <TransformControl label={`الجودة: ${Math.round(exportScale * 100)}%`} value={exportScale * 100} min={10} max={100} step={10} onChange={v => setExportScale(v / 100)} />
                    </div>
                    
                    {audioUrl && (
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <div className="flex items-center justify-between">
                                <h4 className="text-white font-black text-xs uppercase tracking-widest text-emerald-400">التحكم بالصوت</h4>
                                <button onClick={() => setIsMuted(!isMuted)} className={`text-[10px] font-black uppercase ${isMuted ? 'text-red-500' : 'text-emerald-400'}`}>{isMuted ? 'تم كتم الصوت' : 'مفعل'}</button>
                            </div>
                            <TransformControl label="مستوى الصوت" value={volume * 100} min={0} max={100} step={1} onChange={v => setVolume(v / 100)} />
                        </div>
                    )}
                    
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <h4 className="text-white font-black text-xs uppercase tracking-widest text-emerald-400 mb-2">تلاشي الحواف (Edge Fade)</h4>
                        <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
                            يضيف تأثير تدرج شفاف ناعم على حواف الرسوم المتحركة، مما قد يزيد من حجم الملف الناتج.
                        </p>
                        <TransformControl label="أعلى (Top)" value={fadeConfig.top} min={0} max={50} step={1} onChange={v => setFadeConfig(p => ({ ...p, top: v }))} />
                        <TransformControl label="أسفل (Bottom)" value={fadeConfig.bottom} min={0} max={50} step={1} onChange={v => setFadeConfig(p => ({ ...p, bottom: v }))} />
                        <TransformControl label="يسار (Left)" value={fadeConfig.left} min={0} max={50} step={1} onChange={v => setFadeConfig(p => ({ ...p, left: v }))} />
                        <TransformControl label="يمين (Right)" value={fadeConfig.right} min={0} max={50} step={1} onChange={v => setFadeConfig(p => ({ ...p, right: v }))} />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                       <div onClick={() => selectPresetBg(null)} className={`aspect-[9/16] rounded-xl border-2 cursor-pointer flex items-center justify-center text-[8px] text-slate-700 bg-black/20 ${activePreset === 'none' ? 'border-sky-500' : 'border-white/5'}`}>None</div>
                       {presetBgs.map(bg => (
                         <div key={bg.id} onClick={() => selectPresetBg(bg)} className={`aspect-[9/16] rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${activePreset === bg.id ? 'border-sky-500 scale-105' : 'border-white/5 opacity-60 hover:opacity-100'}`}>
                            <img src={bg.url} className="w-full h-full object-cover" />
                         </div>
                       ))}
                    </div>
                </div>
              )}
          </div>

          <div className="bg-slate-900/60 rounded-[2.5rem] p-6 border border-white/10 flex flex-col gap-4 shadow-3xl">
             <div className="flex flex-wrap gap-2">
                {['AE Project', 'SVGA 2.0', 'Image Sequence', 'WebM (Transparent)', 'WebP Image', 'VAP (MP4)'].map(f => (
                  <button key={f} onClick={() => setSelectedFormat(f)} className={`flex-1 py-3 px-2 rounded-xl text-[9px] font-black border transition-all whitespace-nowrap ${selectedFormat === f ? 'bg-sky-500 text-white border-sky-400' : 'bg-slate-950/40 text-slate-300'}`}>{f}</button>
                ))}
             </div>
             <button onClick={handleMainExport} className="w-full py-5 bg-sky-500 hover:bg-sky-400 text-white text-[11px] font-black rounded-[2rem] shadow-glow-sky active:scale-95">بدء التصدير الاحترافي</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TransformControl: React.FC<{ label: string, value: number, min: number, max: number, step?: number, onChange: (v: number) => void }> = ({ label, value, min, max, step = 1, onChange }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center px-1">
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <span className="text-[10px] font-bold text-white bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">{value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-sky-500 cursor-pointer" />
  </div>
);
