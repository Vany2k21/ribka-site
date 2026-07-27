const DELIVERY_LABELS = {
  pickup: 'Самовивіз в Києві',
  kyiv: 'Доставка по Києву',
  'nova-poshta': 'Нова Пошта',
};
const PAYMENT_LABELS = {
  cash: 'Готівкою при отриманні',
  bank: 'Банківський переказ',
};

function escapeHtml(str) {
  return String(str).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}

async function sendOrderNotification(order) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const itemsText = order.items
    .map((i) => `• ${escapeHtml(i.name_ua)} — ${i.quantity} ${i.unitType === 'pcs' ? 'шт' : 'кг'} × ${i.price} грн`)
    .join('\n');

  const text =
    `🐟 <b>Нове замовлення #${order.id}</b>\n\n` +
    `👤 ${escapeHtml(order.firstName)} ${escapeHtml(order.lastName)}\n` +
    `📞 ${escapeHtml(order.phone)}\n` +
    `✉️ ${escapeHtml(order.email)}\n\n` +
    `${itemsText}\n\n` +
    `💰 Разом: <b>${order.total} грн</b>\n` +
    `🚚 ${DELIVERY_LABELS[order.deliveryMethod] || order.deliveryMethod}\n` +
    `💳 ${PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}` +
    (order.comment ? `\n📝 ${escapeHtml(order.comment)}` : '');

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('Telegram notify failed:', res.status, body);
    }
  } catch (err) {
    console.error('Telegram notify error:', err.message);
  }
}

module.exports = { sendOrderNotification };
