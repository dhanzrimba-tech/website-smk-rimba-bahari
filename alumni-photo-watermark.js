/*
 * SMK Kehutanan Rimba Bahari - Alumni Photo Pipeline v3
 * Resize -> WebP -> repeated diagonal monochrome watermark.
 * Original file is never uploaded by this utility.
 */
(function(){
  const DEFAULTS={
    maxSize:1200,
    quality:.72,
    watermarkText:'SMK KEHUTANAN RIMBA BAHARI SUMEDANG',
    watermarkOpacity:.055,
    logoSrc:'logo-sekolah-monokrom-watermark.png'
  };
  function loadImage(src){
    return new Promise((resolve,reject)=>{
      const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=src;
    });
  }
  async function prepareAlumniPhoto(file,opts={}){
    const o={...DEFAULTS,...opts};
    if(!file || !file.type.startsWith('image/')) throw new Error('File harus berupa gambar.');
    const bitmap=await createImageBitmap(file);
    const scale=Math.min(1,o.maxSize/Math.max(bitmap.width,bitmap.height));
    const w=Math.max(1,Math.round(bitmap.width*scale)), h=Math.max(1,Math.round(bitmap.height*scale));
    const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext('2d'); ctx.drawImage(bitmap,0,0,w,h); bitmap.close();
    const logo=await loadImage(o.logoSrc);
    const fs=Math.max(9,Math.round(Math.min(w,h)*.028));
    const font=`700 ${fs}px Arial,sans-serif`;
    const tile=document.createElement('canvas'); tile.width=Math.max(260,Math.round(w*.34)); tile.height=Math.max(110,Math.round(h*.16));
    const tc=tile.getContext('2d'); tc.clearRect(0,0,tile.width,tile.height); tc.font=font; tc.fillStyle=`rgba(105,105,105,${o.watermarkOpacity})`; tc.textBaseline='middle';
    tc.fillText(o.watermarkText,8,tile.height*.60);
    const lw=Math.max(18,Math.round(fs*1.35)), lh=Math.round(logo.naturalHeight*lw/logo.naturalWidth);
    tc.drawImage(logo,8,Math.max(1,tile.height*.60-lh*.75),lw,lh);
    const rotated=document.createElement('canvas'); const ang=-28*Math.PI/180;
    const rw=Math.ceil(Math.abs(tile.width*Math.cos(ang))+Math.abs(tile.height*Math.sin(ang)));
    const rh=Math.ceil(Math.abs(tile.width*Math.sin(ang))+Math.abs(tile.height*Math.cos(ang)));
    rotated.width=rw; rotated.height=rh;
    const rc=rotated.getContext('2d'); rc.translate(rw/2,rh/2); rc.rotate(ang); rc.drawImage(tile,-tile.width/2,-tile.height/2);
    const stepX=Math.max(110,Math.round(rw*.72)), stepY=Math.max(85,Math.round(rh*.52));
    for(let y=-rh;y<h+rh;y+=stepY){ const row=Math.round(y/stepY); const off=row%2===0?0:Math.round(stepX/2); for(let x=-rw;x<w+rw;x+=stepX) ctx.drawImage(rotated,x+off,y); }
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Gagal membuat WebP.')),'image/webp',o.quality));
    const base=(file.name||'alumni').replace(/\.[^.]+$/,'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-');
    return new File([blob],`${base}.webp`,{type:'image/webp',lastModified:Date.now()});
  }
  window.AlumniPhotoPipeline={prepareAlumniPhoto};
})();
