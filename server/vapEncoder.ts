import ffmpeg from './ffmpeg';
import path from 'path';

function encode(input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputFilename = `vap-${Date.now()}.mp4`;
    const outputPath = path.join(process.cwd(), 'exports', outputFilename);

    ffmpeg(input)
      .videoFilters([
        "crop=iw:ih-150:0:150",
        "format=rgba"
      ])
      .outputOptions([
        "-pix_fmt yuva420p",
        "-vcodec libx264"
      ])
      .save(outputPath)
      .on("end", () => {
        // Return relative path for client access
        resolve(`/exports/${outputFilename}`);
      })
      .on("error", (err) => {
        console.error("FFmpeg Error:", err);
        reject(err);
      });
  });
}

export default encode;
