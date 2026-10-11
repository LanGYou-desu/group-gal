// 样式按块拆分的引入顺序会影响层叠，保持与源文件中的先后一致
import './styles/tokens.css';
import './styles/title.css';
import './styles/chat.css';
import './styles/chrome.css';

import { mountShell } from './ui/shell';

const root = document.getElementById('app');
if (!root) throw new Error('缺少挂载点 #app');

mountShell(root);
