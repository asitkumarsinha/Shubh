function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function wholesalePriceOf(medicine) {
  if (medicine.wholesale_price != null && medicine.wholesale_price !== '') {
    return roundMoney(medicine.wholesale_price);
  }
  return roundMoney(Number(medicine.price) * 0.9);
}

function unitPrice(medicine, user) {
  if (user && user.role === 'user' && user.client_group === 'wholesale') {
    return wholesalePriceOf(medicine);
  }
  return roundMoney(medicine.price);
}

function decorateMedicine(medicine, user) {
  const wholesale = wholesalePriceOf(medicine);
  const unit = unitPrice(medicine, user);
  return {
    ...medicine,
    wholesale_price: wholesale,
    listPrice: roundMoney(medicine.price),
    price: unit,
    unitPrice: unit,
  };
}

module.exports = { roundMoney, wholesalePriceOf, unitPrice, decorateMedicine };
