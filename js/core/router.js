import { ROUTES } from '../config.js';
import { state } from './state.js';
import { events } from './event-bus.js';

function parse(hash){
  const clean=String(hash||'').replace(/^#\/?/,'');
  const [rawRoute='home',query='']=clean.split('?');
  const route=ROUTES.has(rawRoute||'home')?(rawRoute||'home'):'home';
  return {route,params:Object.fromEntries(new URLSearchParams(query))};
}
class Router{
  start(){addEventListener('hashchange',()=>this.sync());this.sync();}
  navigate(route,params={},replace=false){
    const safe=ROUTES.has(route)?route:'home';const query=new URLSearchParams(Object.entries(params||{}).filter(([,v])=>v!==undefined&&v!==null&&v!=='')).toString();const target=`#${safe}${query?`?${query}`:''}`;
    if(replace)history.replaceState(null,'',target);else if(location.hash!==target)location.hash=target;this.sync();
  }
  sync(){const parsed=parse(location.hash);state.set('route',parsed.route);state.set('routeParams',parsed.params);events.emit('route:change',parsed);}
}
export const router=new Router();
