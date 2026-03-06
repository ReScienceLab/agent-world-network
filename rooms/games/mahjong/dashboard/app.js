const U = {
  '1m':'🀇','2m':'🀈','3m':'🀉','4m':'🀊','5m':'🀋','6m':'🀌','7m':'🀍','8m':'🀎','9m':'🀏',
  '1p':'🀙','2p':'🀚','3p':'🀛','4p':'🀜','5p':'🀝','6p':'🀞','7p':'🀟','8p':'🀠','9p':'🀡',
  '1s':'🀐','2s':'🀑','3s':'🀒','4s':'🀓','5s':'🀔','6s':'🀕','7s':'🀖','8s':'🀗','9s':'🀘',
  '1z':'🀀','2z':'🀁','3z':'🀂','4z':'🀃','5z':'🀄','6z':'🀅','7z':'🀆',
}
const BACKS = '🀫'
const ROUNDS = {1:'东风',2:'南风',3:'西风',4:'北风'}

const $ = id => document.getElementById(id)
const t = tile => U[tile] ?? tile

function renderState(s) {
  const round = (ROUNDS[s.round] ?? '东风') + (s.gameCount ?? 1) + '局'
  $('round').textContent = round
  $('wall').textContent = s.wallSize ?? '—'
  $('dora').textContent = s.doraIndicator ? '宝牌指示: ' + t(s.doraIndicator) : ''

  for (const seat of ['east','south','west','north']) {
    const p = s.participants?.[seat]
    $(`nm-${seat}`).textContent = p?.name ?? '等待加入...'
    if (s.scores?.[seat] !== undefined) $(`sc-${seat}`).textContent = s.scores[seat].toLocaleString()

    // Hand (back tiles by count)
    const hd = $(`hd-${seat}`)
    hd.innerHTML = ''
    const cnt = s.hands?.[seat]?.count ?? 0
    for (let i = 0; i < cnt; i++) {
      const sp = document.createElement('span')
      sp.className = 'tile-back'
      sp.textContent = BACKS
      hd.appendChild(sp)
    }

    // Discards
    const dc = $(`dc-${seat}`)
    dc.innerHTML = ''
    for (const tile of (s.discards?.[seat] ?? [])) {
      const sp = document.createElement('span')
      sp.textContent = t(tile)
      dc.appendChild(sp)
    }

    // Melds
    const ml = $(`ml-${seat}`)
    ml.innerHTML = ''
    for (const m of (s.melds?.[seat] ?? [])) {
      const sp = document.createElement('span')
      sp.className = 'meld-group'
      sp.textContent = (m.tiles ?? []).map(t).join('')
      ml.appendChild(sp)
    }
  }
}

function renderMove(d) {
  if (d.action === 'discard' && d.tile) {
    const dc = $(`dc-${d.seat}`)
    if (dc && dc.lastChild) dc.lastChild.classList.add('last-discard')
  }
  if (d.wallSize !== undefined) $('wall').textContent = d.wallSize
}

function renderThinking(d) {
  for (const s of ['east','south','west','north']) {
    const el = $(`th-${s}`)
    if (!el) continue
    el.innerHTML = s === d.seat ? '<span class="thinking"></span>' : ''
  }
}

function renderLobby(d) {
  for (const s of ['east','south','west','north']) {
    const p = d.participants?.[s]
    $(`nm-${s}`).textContent = p?.name ?? '等待加入...'
  }
}

function showGameover(d) {
  const ov = $('overlay')
  if (d.winner) {
    $('ov-win').textContent = '🎉 ' + d.winner + ' 胡牌！'
    $('ov-pts').textContent = d.points + ' 点 ' + (d.isTsumo ? '(自摸)' : '(荣和)')
    $('ov-yaku').textContent = (d.yaku ?? []).join(' · ')
  } else {
    $('ov-win').textContent = '流局'
    $('ov-pts').textContent = d.reason ?? ''
    $('ov-yaku').textContent = ''
  }
  ov.classList.add('show')
  setTimeout(() => ov.classList.remove('show'), 7000)
}

function appendLog(from, to, type, summary, ts) {
  const log = $('log')
  const el = document.createElement('div')
  el.className = 'log-entry'
  const time = new Date(ts).toLocaleTimeString('zh', {hour12:false})
  el.innerHTML = `<div class="route">${from} → ${to} <b style="color:#a5d6a7">${type}</b><span class="ts">${time}</span></div><div class="payload">${summary}</div>`
  log.prepend(el)
  while (log.children.length > 200) log.removeChild(log.lastChild)
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const ws = new WebSocket(`${proto}//${location.host}/ws`)
  ws.onopen = () => { $('conn-status').textContent = '● Connected'; $('conn-status').style.color = '#4caf50' }
  ws.onclose = () => { $('conn-status').textContent = '○ Reconnecting...'; $('conn-status').style.color = '#f44336'; setTimeout(connect, 3000) }
  ws.onerror = () => ws.close()
  ws.onmessage = ({data}) => {
    let msg
    try { msg = JSON.parse(data) } catch { return }
    const {event, data: d} = msg
    switch (event) {
      case 'state':    renderState(d); break
      case 'move':     renderMove(d); break
      case 'thinking': renderThinking(d); break
      case 'lobby':    renderLobby(d); break
      case 'gameover': showGameover(d); break
      case 'p2p':      appendLog(d.from, d.to, d.type, d.summary, d.ts); break
    }
  }
}
connect()
