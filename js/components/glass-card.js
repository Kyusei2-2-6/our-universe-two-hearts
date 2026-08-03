export function createOrbitCard(card, onOpen) {
  const button=document.createElement('button');
  button.type='button';button.className='orbit-card';button.dataset.route=card.route;
  const icon=document.createElement('span');icon.className='orbit-card__icon';icon.textContent=card.icon;
  const copy=document.createElement('span');
  const label=document.createElement('span');label.className='orbit-card__label';label.textContent=card.label;
  const desc=document.createElement('small');desc.className='muted';desc.textContent=card.description;
  copy.append(label,document.createElement('br'),desc);button.append(icon,copy);
  button.onclick=()=>onOpen(card.route);return button;
}
