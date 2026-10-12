/* What the panel says about an update check or an update. Pure — tested in Node. */

const REASON = {
  offline: 'Нет связи с GitHub — проверьте интернет',
  'no-git': 'На этой машине не найден git — обновление недоступно',
  'not-git': 'JS-Art установлен не клоном git — переустановите его через git clone',
  detached: 'Репозиторий не на ветке — переключитесь на main',
  'no-upstream': 'Ветка не связана с GitHub — обновление недоступно',
};

/* {text, kind: 'ok' | 'err' | '', armed} for a check result (GET) */
export function checkStatus(r) {
  if (!r || !r.ok) {
    const why = r && (REASON[r.reason] || (r.error ? 'Ошибка git: ' + r.error : 'Не удалось проверить обновление'));
    return { text: why || 'Не удалось проверить обновление', kind: 'err', armed: false };
  }
  if (r.dirty && r.behind) return { text: 'Есть несохранённые изменения в папке JS-Art — обновление отменено', kind: 'err', armed: false };
  if (r.ahead) return { text: 'Есть локальные коммиты — обновляйте вручную (git pull)', kind: 'err', armed: false };
  if (!r.behind) return { text: `Установлена последняя версия (${r.current})`, kind: 'ok', armed: false };
  return { text: `Доступно обновление: ${r.behind} коммит(ов) → ${r.latest}. Нажмите ещё раз, чтобы обновить`, kind: '', armed: true };
}

/* {text, kind} for an apply result (POST); restart is set when the server restarts itself */
export function applyStatus(r) {
  if (!r || !r.ok) return { ...checkStatus(r), armed: false };
  if (r.reason === 'dirty') return { text: 'Есть несохранённые изменения в папке JS-Art — обновление отменено', kind: 'err', armed: false };
  if (r.reason === 'diverged') return { text: 'Есть локальные коммиты — обновляйте вручную (git pull)', kind: 'err', armed: false };
  if (!r.updated) return { text: `Установлена последняя версия (${r.current})`, kind: 'ok', armed: false };
  const next = r.restart
    ? 'сервер перезапускается — через пару секунд обновите страницу'
    : 'перезапустите сервер и обновите страницу';
  return { text: `Обновлено до ${r.to || r.latest}: ${next}`, kind: 'ok', armed: false };
}

/* what to say when the update route did not answer with JSON: an old server without it answers 404 */
export function noRouteText(status) {
  if (status === 404) return 'Сервер запущен старой версией без проверки обновлений — перезапустите сервер (start-js-art.bat)';
  if (status) return `Сервер ответил ошибкой ${status} — проверка обновлений недоступна`;
  return 'Нет связи с сервером JS-Art — проверка обновлений доступна только при запуске через сервер';
}
