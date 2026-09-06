import { useEffect } from 'react';

function setText(selector:string,value?:string){if(!value)return;const el=document.querySelector<HTMLElement>(selector);if(el)el.textContent=value}

export function PublicCmsBridge(){
  useEffect(()=>{
    let active=true;
    fetch('/api/public/cms',{credentials:'same-origin'})
      .then(r=>r.ok?r.json():Promise.reject(new Error('cms unavailable')))
      .then(({settings})=>{
        if(!active||!settings)return;
        setText('.hero-copy .script',settings.hero_eyebrow);
        setText('.hero-copy h1',settings.hero_title);
        setText('.hero-copy .lead',settings.hero_lead);
        setText('.hero-buttons .primary-ghost',settings.hero_primary_cta);
        setText('.hero-buttons .secondary-btn',settings.hero_secondary_cta);
        setText('.cta h2',settings.cta_title);
        setText('.cta-copy p',settings.cta_copy);
        setText('.footer-grid>div:first-child>p',settings.footer_copy);
        const phone=document.querySelector<HTMLAnchorElement>('.nav-actions .phone');
        if(phone&&settings.contact_phone){phone.textContent=settings.contact_phone;phone.href=`tel:${String(settings.contact_phone).replace(/[^+\d]/g,'')}`}
        const contact=document.querySelectorAll<HTMLElement>('.footer-grid>div:nth-child(4) span');
        if(contact[0]&&settings.contact_phone)contact[0].textContent=settings.contact_phone;
        if(contact[1]&&settings.contact_email)contact[1].textContent=settings.contact_email;
        if(contact[2]&&settings.contact_location)contact[2].textContent=settings.contact_location;
        const hero=document.querySelector<HTMLElement>('.hero');
        if(hero&&settings.hero_image)hero.style.backgroundImage=`url(${JSON.stringify(settings.hero_image).slice(1,-1)})`;
      })
      .catch(()=>{});
    return()=>{active=false};
  },[]);
  return null;
}
