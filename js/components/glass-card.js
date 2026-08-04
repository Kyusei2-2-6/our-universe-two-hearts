export function createOrbitCard(card, onOpen) {
  const button=document.createElement('button');
  button.type='button';
  button.className='orbit-card';
  button.dataset.route=card.route;

  const planet=document.createElement('span');
  planet.className='orbit-card__planet';
  planet.setAttribute('aria-hidden','true');

  const icon=document.createElement('span');
  icon.className='orbit-card__icon';
  icon.textContent=card.icon;
  planet.append(icon);

  const copy=document.createElement('span');
  copy.className='orbit-card__copy';
  const label=document.createElement('span');
  label.className='orbit-card__label';
  label.textContent=card.label;
  const desc=document.createElement('small');
  desc.className='muted';
  desc.textContent=card.description;
  copy.append(label,desc);

  button.append(planet,copy);
  button.onclick=()=>onOpen(card.route);
  return button;
}
