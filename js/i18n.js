(function () {
  const EN = {
    // верхняя панель и инструменты
    '+ этаж': '+ floor', '− этаж': '− floor', 'Импорт': 'Import', 'Вставить JSON': 'Paste JSON', 'Экспорт': 'Export', 'Копировать': 'Copy', 'Новый': 'New', '? Справка': '? Help',
    'двери открыты': 'doors open', 'Картинка…': 'Image…', 'SVG (план)': 'SVG (plan)',
    'Выбор': 'Select', 'Комната': 'Room', 'Многоуг.': 'Polygon', 'Стена': 'Wall', 'Дверь': 'Door', 'Окно': 'Window', 'Проём': 'Opening', 'Линейка': 'Ruler', 'Рука': 'Pan', 'Вписать': 'Fit',
    '+ Своя мебель': '+ Custom item', 'Спальня': 'Bedroom', 'Гостиная': 'Living room', 'Кухня': 'Kitchen', 'Ванная': 'Bathroom', 'Прочее': 'Other', 'Свет и электрика': 'Lights & electrics',
    // 3D-панель
    'Стены': 'Walls', 'Полные': 'Full', 'Полупрозрачные': 'Translucent', 'Срезанные': 'Cut', 'Без стен': 'No walls', 'Срез': 'Cut height', 'Прозрачность': 'Opacity', 'Камера': 'Camera',
    'Облёт': 'Orbit', 'Сверху': 'Top', 'Изнутри (ходьба)': 'Walk', 'Встать в комнату': 'Go to room', 'Автообход': 'Auto tour', 'потолок': 'ceiling', 'вечер (лампы)': 'evening (lamps)',
    'Яркость ламп': 'Lamp brightness', 'Выключить свет': 'Lights off', 'Включить свет': 'Lights on',
    // свойства
    'Этаж и настройки': 'Floor & settings', 'Название этажа': 'Floor name', 'Высота потолка, м': 'Ceiling height, m', 'Толщина стен, м': 'Wall thickness, m', 'Шаг сетки, м': 'Grid step, m',
    'Размеры на плане': 'Dimensions on plan', 'Мебель с комнатой': 'Furniture follows room', 'Текстура пола на плане': 'Floor texture on plan', 'Все двери открыты': 'All doors open',
    '+ Комната': '+ Room', '+ Стена': '+ Wall', 'Площади': 'Areas', 'Комнаты': 'Rooms', 'Название': 'Name', 'Площадь': 'Area', 'Периметр': 'Perimeter', 'Пол': 'Floor', 'Покрытие': 'Material',
    'Потолок': 'Ceiling', 'Удалить': 'Delete', 'Дублировать': 'Duplicate', 'Снять выбор': 'Deselect', 'Мебель': 'Furniture', 'Тип': 'Type', 'Ширина, м': 'Width, m', 'Глубина, м': 'Depth, m',
    'Высота, м': 'Height, m', 'Поворот, °': 'Rotation, °', 'Цвет': 'Color', 'Отделка': 'Finish', 'Открыта': 'Open', 'Входная дверь': 'Entrance door', 'Длина, м': 'Length, m', 'Угол, °': 'Angle, °',
    'Толщина, м': 'Thickness, m', 'Смещение, м': 'Offset, m', 'Высота проёма, м': 'Opening height, m', 'Включён': 'On', 'Отзеркалить': 'Mirror', 'Объединение комнат': 'Merge rooms',
    'Добавить проём': 'Add opening', '+ Дверь': '+ Door', '+ Окно': '+ Window', '+ Проём': '+ Opening', 'Готово': 'Done', 'Закрыть': 'Close', 'Отмена': 'Cancel', 'Загрузить': 'Load', 'Создать': 'Create',
    'Справка': 'Help', 'Материал': 'Material', 'Сбросить цвет': 'Reset color', 'Свой цвет': 'Custom color', 'Двери': 'Doors', 'Название проекта': 'Project name',
    'Не удалось прочитать JSON': 'Could not read JSON','Закрыть двери': 'Close doors', 'Открыть двери': 'Open doors', 'Солнце': 'Sun', 'Авто': 'Auto',
    'Перила (открытый балкон)': 'Railings (open balcony)', 'Стена к квартире': 'Wall to apartment', 'Перила на остальных сторонах': 'Railings on other sides', 'Убрать перила': 'Remove railings',
    'Север — перила': 'North — railing', 'Юг — перила': 'South — railing', 'Запад — перила': 'West — railing', 'Восток — перила': 'East — railing'
  };
  const RULES = [[/^Комната (\d+)$/, 'Room $1'], [/^Вершина (\d+)$/, 'Vertex $1'], [/^Сторона (\d+)$/, 'Side $1'], [/^Стена (\d+) — /, 'Wall $1 — '], [/ м²$/, ' m²'], [/(\d) м$/, '$1 m']];
  let lang = 'ru'; try { lang = localStorage.getItem('fp_lang') || 'ru'; } catch (e) {}
  const orig = new WeakMap();
  FP.lang = () => lang;
  FP.T = s => (lang === 'en' && EN[s]) || s;               // для alert/confirm в JS
  function tx(s) { const k = s.trim(); if (!k) return null; if (EN[k]) return s.replace(k, EN[k]); for (const r of RULES) if (r[0].test(k)) return s.replace(k, k.replace(r[0], r[1])); return null; }
  function walk(root) {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = tw.nextNode())) {
      if (/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName)) continue;
      const o = orig.has(n) ? orig.get(n) : n.nodeValue;
      if (lang === 'en') { const t = tx(o); if (t != null) { orig.set(n, o); n.nodeValue = t; } }
      else if (orig.has(n)) { n.nodeValue = orig.get(n); orig.delete(n); }
    }
    if (root.querySelectorAll) root.querySelectorAll('[title],[placeholder]').forEach(el => ['title', 'placeholder'].forEach(a => {
      if (!el.hasAttribute(a)) return; const k = 'ru' + a; if (!(k in el.dataset)) el.dataset[k] = el.getAttribute(a);
      const ru = el.dataset[k]; el.setAttribute(a, lang === 'en' ? (EN[ru] || ru) : ru);
    }));
  }
  new MutationObserver(ms => { if (lang !== 'en') return; ms.forEach(m => m.addedNodes.forEach(n => walk(n.nodeType === 1 ? n : n.parentNode))); }).observe(document.body, { childList: true, subtree: true });
  function apply() { document.documentElement.lang = lang; walk(document.body); FP.ui && FP.ui.props(); }
  FP.$('btnLang').textContent = lang === 'en' ? 'RU' : 'EN';
  FP.$('btnLang').onclick = () => { lang = lang === 'en' ? 'ru' : 'en'; try { localStorage.setItem('fp_lang', lang); } catch (e) {} FP.$('btnLang').textContent = lang === 'en' ? 'RU' : 'EN'; apply(); };
  apply();
})();
