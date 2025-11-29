function saveAcosSettings(breakEven, low, high) {
  // Debug przed zapisem
  console.log('PRZED ZAPISEM:', breakEven, low, high);
  
  // Sprawdź czy wartości są prawidłowe
  if (!breakEven || !low || !high) {
    console.error('Błędne wartości ACOS:', breakEven, low, high);
    return 'Błąd: nieprawidłowe wartości';
  }
  
  // Zapisz jako string
  PropertiesService.getDocumentProperties().setProperties({
    'ACOS_BREAK_EVEN': String(breakEven),  // Użyj String() zamiast toString()
    'ACOS_LOW': String(low),
    'ACOS_HIGH': String(high)
  });
  
  // Weryfikacja zapisu
  const saved = PropertiesService.getDocumentProperties().getProperty('ACOS_BREAK_EVEN');
  console.log('PO ZAPISIE - wartość ACOS_BREAK_EVEN:', saved);
  
  return '✅ Zapisano progi ACOS: BE=' + breakEven + '%, Low=' + low + '%, High=' + high + '%';
}