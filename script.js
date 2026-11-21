const CLOUD_FUNCTION_URL = 'https://functions.yandexcloud.net/d4ef7tqpngn4inqlmb3u';

const coffeeInputs = document.querySelectorAll('input[name="coffee"]');
const sizeInputs = document.querySelectorAll('input[name="size"]');
const extraInputs = document.querySelectorAll('input[name="extra"]');

const drinkOutput = document.querySelector('#order-drink');
const sizeOutput = document.querySelector('#order-size');
const extrasOutput = document.querySelector('#order-extras');
const totalOutput = document.querySelector('#total-price');
const mobileDrinkOutput = document.querySelector('#mobile-order-drink');
const mobileTotalOutput = document.querySelector('#mobile-order-total');
const mobileOrderBar = document.querySelector('#mobile-order-bar');
const coffeeSection = document.querySelector('#coffee');
const mainOrderTotal = document.querySelector('#total-price');

function updateOrder() {
  const coffee = document.querySelector('input[name="coffee"]:checked');
  const size = document.querySelector('input[name="size"]:checked');
  const extras = [...extraInputs].filter((input) => input.checked);

  if (!coffee || !size) return;

  const total = Number(coffee.dataset.price)
    + Number(size.dataset.price)
    + extras.reduce((sum, extra) => sum + Number(extra.dataset.price), 0);

  drinkOutput.textContent = coffee.closest('label').querySelector('.choice-name').textContent;
  sizeOutput.textContent = `Размер ${size.value} · ${size.closest('label').querySelector('.size-detail').textContent}`;
  extrasOutput.textContent = extras.length
    ? extras.map((extra) => extra.closest('label').querySelector('.extra-name').textContent).join(', ')
    : 'Без добавок';
  totalOutput.textContent = `${total} ₽`;
  mobileDrinkOutput.textContent = drinkOutput.textContent;
  mobileTotalOutput.textContent = `${total} ₽`;
}

[...coffeeInputs, ...sizeInputs, ...extraInputs].forEach((input) => {
  input.addEventListener('change', updateOrder);
});

updateOrder();

const mobileViewport = window.matchMedia('(max-width: 768px)');
let isCalculatorInView = false;
let isMainTotalInView = false;

function updateMobileOrderBar() {
  mobileOrderBar.classList.toggle(
    'is-visible',
    mobileViewport.matches && isCalculatorInView && !isMainTotalInView
  );
}

if ('IntersectionObserver' in window) {
  const barObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.target === coffeeSection) {
        isCalculatorInView = entry.isIntersecting;
      }
      if (entry.target === mainOrderTotal) {
        isMainTotalInView = entry.isIntersecting;
      }
    });

    updateMobileOrderBar();
  }, {
    threshold: 0.08
  });

  barObserver.observe(coffeeSection);
  barObserver.observe(mainOrderTotal);
} else {
  isCalculatorInView = false;
  isMainTotalInView = false;
}

mobileViewport.addEventListener('change', (event) => {
  if (!event.matches) {
    mobileOrderBar.classList.remove('is-visible');
  } else {
    updateMobileOrderBar();
  }
});

const orderModal = document.querySelector('#order-modal');
const orderForm = document.querySelector('#order-form');
const formStatus = document.querySelector('#form-status');
const submitButtonText = document.querySelector('#submit-button-text');
const submitButton = orderForm.querySelector('button[type="submit"]');
const orderToast = document.querySelector('#order-toast');

function openOrderModal() {
  document.querySelector('#modal-drink').textContent = drinkOutput.textContent;
  document.querySelector('#modal-size').textContent = sizeOutput.textContent.replace('Размер ', '');
  document.querySelector('#modal-extras').textContent = extrasOutput.textContent;
  document.querySelector('#modal-total').textContent = totalOutput.textContent;
  formStatus.textContent = '';
  orderModal.classList.add('is-open');
  orderModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  orderModal.querySelector('input[name="name"]').focus();
}

function closeOrderModal() {
  orderModal.classList.remove('is-open');
  orderModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

document.querySelectorAll('.open-order-modal').forEach((button) => {
  button.addEventListener('click', openOrderModal);
});

document.querySelectorAll('[data-close-modal]').forEach((element) => {
  element.addEventListener('click', closeOrderModal);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && orderModal.classList.contains('is-open')) {
    closeOrderModal();
  }
});

orderForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(orderForm);
  const name = formData.get('name').trim();
  const contact = formData.get('contact').trim();

  if (!name || !contact) {
    formStatus.textContent = 'Заполните имя и контакт.';
    return;
  }

  if (CLOUD_FUNCTION_URL.includes('YOUR_FUNCTION_ID')) {
    formStatus.textContent = 'Укажите адрес Yandex Cloud Function в CLOUD_FUNCTION_URL.';
    return;
  }

  const extrasText = extrasOutput.textContent;
  submitButton.disabled = true;
  submitButtonText.textContent = 'Отправляем...';
  formStatus.textContent = '';

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 7000);
    let response;

    try {
      response = await fetch(
      CLOUD_FUNCTION_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone: contact,
          order: {
            drink: drinkOutput.textContent,
            size: sizeOutput.textContent,
            extras: extrasText,
            total: totalOutput.textContent
          }
        }),
        signal: controller.signal
      });
    } finally {
      window.clearTimeout(timeout);
    }

    let result;
    try {
      result = await response.json();
    } catch (error) {
      result = {};
    }

    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Не удалось отправить заказ');
    }

    closeOrderModal();
    orderForm.reset();
    orderToast.classList.add('is-visible');
    window.setTimeout(() => orderToast.classList.remove('is-visible'), 4000);
  } catch (error) {
    formStatus.textContent = error.name === 'AbortError'
      ? 'Сервер не ответил вовремя. Повторите отправку.'
      : (error.message || 'Не удалось отправить заказ. Проверьте настройки Telegram.');
  } finally {
    submitButton.disabled = false;
    submitButtonText.textContent = 'Отправить заказ';
  }
});
