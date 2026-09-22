"use client";
import { useState } from 'react';
import Image from 'next/image';
import { Bean, Carrot, Cherry, Egg, Fish, Leaf, Milk, Wheat, CookingPot, Apple, Banana, Nut } from 'lucide-react';

/**
 * A recipe or food's picture when it has one; otherwise a quiet subject mark
 * (one line icon, or the kitchen's own drawn bowl for its prep dishes).
 * Never a stock photo standing in for the dish.
 */
export function FoodVisual({ name, imageUrl, compact = false }: { name: string; imageUrl?: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const text = name.toLowerCase();
  const Icon = /banana/.test(text) ? Banana : /apple/.test(text) ? Apple : /almond|nut/.test(text) ? Nut : /tofu|bean|lentil|chickpea|dal/.test(text) ? Bean : /oat|rice|bread|quinoa|pasta|noodle|grain/.test(text) ? Wheat : /milk|yogurt|cheese/.test(text) ? Milk : /egg/.test(text) ? Egg : /fish|salmon|tuna|shrimp/.test(text) ? Fish : /apple|banana|mango|fruit|cherry|berry/.test(text) ? Cherry : /cabbage|spinach|basil|greens|salad/.test(text) ? Leaf : /carrot|tomato|pepper|vegetable|onion|garlic/.test(text) ? Carrot : CookingPot;
  const dish = /inspired|dal|bowls|jars|noodles|spaghetti|soup|stir.fry|curry/.test(text);
  let source = imageUrl;
  if (source?.startsWith('https://www.themealdb.com/images/media/meals/') && !/\/(small|medium|large)$/.test(source)) source += '/medium';
  return <div className={`relative overflow-hidden ${compact ? 'size-10 shrink-0 rounded-lg' : 'aspect-[3/2] w-full rounded-lg'} bg-[var(--bg)]`}>
    {source && !failed ? <Image src={source} alt={name} fill sizes={compact ? '40px' : '(max-width: 640px) 100vw, 400px'} className="object-cover" unoptimized loading="lazy" onError={() => setFailed(true)} /> : <div className="absolute inset-0 flex items-center justify-center text-[var(--text-faint)]" role="img" aria-label={`${name}, subject mark`}>
      {dish ? <DishArt name={text} compact={compact} /> : <Icon strokeWidth={1.25} className={compact ? 'size-5' : 'size-10'} />}
    </div>}
  </div>;
}

function DishArt({name,compact}:{name:string;compact:boolean}) {
  if (/oat|jars/.test(name)) return <svg viewBox="0 0 240 150" className={compact ? 'size-10' : 'w-3/5 max-h-[80%]'} aria-hidden="true">
    <ellipse cx="120" cy="134" rx="64" ry="9" fill="#4b5847" opacity=".12"/>
    <path d="M75 28H165V122Q165 134 150 134H90Q75 134 75 122Z" fill="#f8f4df" stroke="#68765b" strokeWidth="2"/>
    <path d="M79 69H161V119Q161 129 148 129H92Q79 129 79 119Z" fill="#d6bf8b"/>
    {[0,1,2,3,4,5,6,7,8].map(i=><ellipse key={i} cx={92+i%3*27} cy={84+Math.floor(i/3)*17} rx="7" ry="3" fill="#f4e7c4" transform={`rotate(-15 ${92+i%3*27} ${84+Math.floor(i/3)*17})`}/>)}
    <path d="M85 61l12-18 13 11-11 15Z M123 59l11-21 17 12-8 17Z" fill="#f0d5a4" stroke="#ad5648" strokeWidth="3"/>
    <ellipse cx="117" cy="63" rx="6" ry="11" fill="#a47a49" transform="rotate(35 117 63)"/>
    <rect x="70" y="21" width="100" height="12" rx="5" fill="#9eaf8a" stroke="#68765b" strokeWidth="2"/>
    <path d="M85 39v33" stroke="white" strokeWidth="4" opacity=".8" strokeLinecap="round"/>
  </svg>;
  const red = /tomato|nigerian/.test(name);
  const golden = /dal|indian|oat/.test(name);
  const tofu = /tofu/.test(name);
  const grain = /oat|quinoa|rice/.test(name);
  const sauce = red ? '#b9533c' : golden ? '#d6aa47' : '#87a178';
  return <svg viewBox="0 0 240 150" className={compact ? 'size-10' : 'w-3/5 max-h-[80%]'} aria-hidden="true">
    <ellipse cx="120" cy="128" rx="86" ry="11" fill="#4b5847" opacity=".12"/>
    <path d="M29 66 Q35 130 120 133 Q205 130 211 66Z" fill="#ece7d6" stroke="#68765b" strokeWidth="2"/>
    <ellipse cx="120" cy="67" rx="92" ry="43" fill="#faf8ee" stroke="#68765b" strokeWidth="2"/>
    <ellipse cx="120" cy="67" rx="80" ry="33" fill={sauce}/>
    {[0,1,2,3,4,5,6,7].map(i=>{const x=66+(i%4)*35;const y=52+Math.floor(i/4)*25;return tofu ? <g key={i} transform={`translate(${x} ${y}) rotate(${i%2?15:-12})`}><rect width="22" height="17" rx="4" fill="#f4ddb1" stroke="#c89c60"/><path d="M4 5h12" stroke="#e8c994" strokeWidth="2"/></g> : <g key={i} fill={grain?'#f2e4bb':'#d9b06d'}><ellipse cx={x} cy={y} rx="8" ry="5" transform={`rotate(20 ${x} ${y})`}/><ellipse cx={x+10} cy={y+8} rx="6" ry="4"/></g>;})}
    {[0,1,2].map(i=><g key={i} transform={`translate(${77+i*42} ${44+i%2*37}) rotate(${i*50})`}><path d="M0 0Q-15-24-22-9Q-24 4 0 0Q18-20 23-5Q20 8 0 0" fill="#3e7656"/><path d="M-13-8 13 1" stroke="#98b88a" strokeWidth="1.5"/></g>)}
    <path d="M43 100Q72 127 111 125" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" opacity=".6"/>
  </svg>;
}
