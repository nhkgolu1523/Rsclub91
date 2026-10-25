/* Add bank account page, rebuilt from the original Veer.Game flow. */
(function () {
  'use strict';
  if (!window.RS || !RS.guard('../home/index.html')) return;

  var BANKS = [
    { bankID: 1, bankName: "Bank of Baroda" },
    { bankID: 2, bankName: "Union Bank of India" },
    { bankID: 3, bankName: "Central Bank of India" },
    { bankID: 4, bankName: "Yes Bank" },
    { bankID: 5, bankName: "HDFC Bank" },
    { bankID: 6, bankName: "Karnataka Bank" },
    { bankID: 7, bankName: "Standard Chartered Bank" },
    { bankID: 8, bankName: "IDBI Bank" },
    { bankID: 9, bankName: "Bank of India" },
    { bankID: 10, bankName: "Punjab National Bank" },
    { bankID: 11, bankName: "ICICI Bank" },
    { bankID: 12, bankName: "Canara Bank" },
    { bankID: 13, bankName: "Kotak Mahindra Bank" },
    { bankID: 14, bankName: "State Bank of India" },
    { bankID: 15, bankName: "Indian Bank" },
    { bankID: 16, bankName: "Axis Bank" },
    { bankID: 17, bankName: "FEDERAL BANK" },
    { bankID: 18, bankName: "Syndicate Bank" },
    { bankID: 19, bankName: "Citibank India" },
    { bankID: 20, bankName: "Bandhan Bank" },
    { bankID: 21, bankName: "Indusind Bank" },
    { bankID: 22, bankName: "India Post Payments Bank" },
    { bankID: 23, bankName: "Corporation Bank" },
    { bankID: 24, bankName: "City Union Bank" },
    { bankID: 25, bankName: "Karur Vysya Bank" },
    { bankID: 26, bankName: "Tamilnad Mercantile Bank" },
    { bankID: 27, bankName: "Allahabad Bank" },
    { bankID: 28, bankName: "varachha co-operative bank" },
    { bankID: 29, bankName: "Meghalaya Rural Bank" },
    { bankID: 30, bankName: "AU Small Finance Bank" },
    { bankID: 31, bankName: "Lakshmi Vilas Bank" },
    { bankID: 32, bankName: "South Indian Bank" },
    { bankID: 33, bankName: "Bassein catholic co-operative Bank" },
    { bankID: 34, bankName: "State Bank of Hyderabad" },
    { bankID: 35, bankName: "Gp parsik bank" },
    { bankID: 36, bankName: "Kerala Gramin Bank" },
    { bankID: 37, bankName: "RBL Bank" },
    { bankID: 38, bankName: "Dhanlaxmi Bank" },
    { bankID: 39, bankName: "TJSB Bank" },
    { bankID: 40, bankName: "Purvanchal bank" },
    { bankID: 41, bankName: "Sarva Haryana Gramin Bank" },
    { bankID: 42, bankName: "Ahmedabad District Co-Operative Bank" },
    { bankID: 43, bankName: "Fino Payments Bank" },
    { bankID: 44, bankName: "Saraswat Cooperative Bank" },
    { bankID: 45, bankName: "Telangana Grameena Bank" },
    { bankID: 46, bankName: "andhra pragathi grameena bank" },
    { bankID: 47, bankName: "rajasthan marudhara gramin bank" },
    { bankID: 48, bankName: "Abhyudaya bank" },
    { bankID: 49, bankName: "ujjivan small finance bank" },
    { bankID: 50, bankName: "capital small finance bank" },
    { bankID: 51, bankName: "Mizoram Rural Bank" },
    { bankID: 52, bankName: "Andhra Pradesh Grameena Vikas Bank" },
    { bankID: 53, bankName: "Karnataka Vikas Grameena Bank" },
    { bankID: 54, bankName: "The Ahmedabad merchantile co-op bank Ltd" },
    { bankID: 55, bankName: "Madhya Bihar Gramin Bank" },
    { bankID: 56, bankName: "NSDL Payments Bank" },
    { bankID: 57, bankName: "ESAF Small Finance Bank" },
    { bankID: 58, bankName: "Himachal Pradesh state cooperative bank" },
    { bankID: 59, bankName: "Maharashtra state cooperative bank" },
    { bankID: 60, bankName: "ORIENTAL BANK OF COMMERCE" },
    { bankID: 61, bankName: "nainital bank" },
    { bankID: 62, bankName: "Jharkhand Rajya Gramin Bank" },
    { bankID: 63, bankName: "jio payments bank" },
    { bankID: 64, bankName: "MAHARASHTRA GRAMIN BANK" },
    { bankID: 65, bankName: "Uttarakhand Gramin Bank" },
    { bankID: 66, bankName: "Himachal Pradesh Gramin Bank" },
    { bankID: 67, bankName: "Krishna District Co-Operative Central Bank Ltd." },
    { bankID: 68, bankName: "RAJKOT NAGARIK SAHAKARI BANK LTD" },
    { bankID: 69, bankName: "North East small financial bank" },
    { bankID: 70, bankName: "Catholic syrian bank" },
    { bankID: 71, bankName: "Fincare small finance bank" },
    { bankID: 72, bankName: "Baroda Uttar Pradesh Gramin Bank" },
    { bankID: 73, bankName: "Dhanalakshmi bank" },
    { bankID: 74, bankName: "Cosmos Co-operative Bank Ltd" },
    { bankID: 75, bankName: "Saurashtra gramin bank" },
    { bankID: 76, bankName: "Baroda Rajasthan kshetriya gramin bank" },
    { bankID: 77, bankName: "Jana small finance bank" },
    { bankID: 78, bankName: "Dena Gujarat Gramin Bank" },
    { bankID: 79, bankName: "Chaitanya Godavari Grameena Bank" },
    { bankID: 80, bankName: "SVC BANK" },
    { bankID: 81, bankName: "Bharat cooperative bank" },
    { bankID: 82, bankName: "The Surat District Co-Op. Bank Ltd." },
    { bankID: 83, bankName: "The Kalupur Commercial Co-operative Bank" },
    { bankID: 84, bankName: "Prime co-operative Bank" },
    { bankID: 85, bankName: "Tripura Gramin Bank" },
    { bankID: 86, bankName: "Zila Sahakari Bank Ltd Bareilly" },
    { bankID: 87, bankName: "ARYAVART Bank" },
    { bankID: 88, bankName: "Development credit Bank" },
    { bankID: 89, bankName: "Sarva UP Gramin Bank" },
    { bankID: 90, bankName: "New India Co-Operative Bank" },
    { bankID: 91, bankName: "NKGSB Co-operative Bank Ltd." },
    { bankID: 92, bankName: "Vijaya Bank" },
    { bankID: 93, bankName: "United Bank of India" },
    { bankID: 94, bankName: "State Bank of Bikaner And Jaipur" },
    { bankID: 95, bankName: "Shri Janata Sahakari Bank LTD" },
    { bankID: 96, bankName: "Rajgurunagar Sahakari Bank" },
    { bankID: 97, bankName: "FEDERAL NEO BANK JUPITER" },
    { bankID: 98, bankName: "CHHATTISGARH RAJYA GRAMIN BANK" },
    { bankID: 99, bankName: "Apna Sahakari Bank" },
    { bankID: 100, bankName: "GS Mahanagar Co-Op Bank Ltd" },
    { bankID: 101, bankName: "Bangiya Gramin Vikash Bank" },
    { bankID: 102, bankName: "Assam Gramin Vikash Bank" },
    { bankID: 103, bankName: "Kangra Central Co-operative Bank Ltd" },
    { bankID: 104, bankName: "Punjab Gramin Bank" },
    { bankID: 105, bankName: "Assam gramin bikash bank" },
    { bankID: 106, bankName: "Karnataka Gramin Bank" },
    { bankID: 107, bankName: "SURYODAY SMALL FINANCE BANK LIMITED" },
    { bankID: 108, bankName: "Utkarsh Small Finance Bank" },
    { bankID: 109, bankName: "The Meghalaya Co-operative Apex Bank" },
    { bankID: 110, bankName: "UTTAR BIHAR GRAMIN BANK" },
    { bankID: 111, bankName: "STATE BANK OF TRAVANCORE" },
    { bankID: 112, bankName: "SHIVALIK SMALL FIHANCE BANK" },
    { bankID: 113, bankName: "DAKSHIN BIHIR GRAMIN BANK" },
    { bankID: 114, bankName: "manipur rural bank" },
    { bankID: 115, bankName: "State bank of patiala" },
    { bankID: 116, bankName: "BARODA GUJARAT GRAMIN BANK" },
    { bankID: 117, bankName: "The Gujarat State Co-operative Bank Limited" },
    { bankID: 118, bankName: "vasai vikas sahakari" },
    { bankID: 119, bankName: "paschim banga gramin bank" },
    { bankID: 120, bankName: "VISHAPATNAM co-operative bank" },
    { bankID: 121, bankName: "Samarth Sahakari Bank Ltd" },
    { bankID: 122, bankName: "uttarbanga kshetriya gramin bank" },
    { bankID: 123, bankName: "janata sahakari bank ltd" },
    { bankID: 124, bankName: "the gayatri co-operative urban bank" },
    { bankID: 125, bankName: "ABHYUDAYA CO-OP. BANK LTD." },
    { bankID: 126, bankName: "Post Office Savings Bank" },
    { bankID: 127, bankName: "SBM Bank India" },
    { bankID: 128, bankName: "Bank of maharashtra" },
    { bankID: 129, bankName: "Jind central Co-OP Bank" },
    { bankID: 130, bankName: "PRATHAMA Up Gramin Bank" },
    { bankID: 131, bankName: "State Bank of Mysore" },
    { bankID: 132, bankName: "BARODA U.P BANK" },
    { bankID: 133, bankName: "PURVANCHAL GRAMIN BANK" },
    { bankID: 134, bankName: "The Varachha Co-operative Bank Ltd.,Surat" },
    { bankID: 135, bankName: "State Bank Of Mauritius Ltd" },
    { bankID: 136, bankName: "Kallappanna Awade Janata Bank" },
    { bankID: 137, bankName: "HIMACHAL PARDESH STATE COOPERATIVE BANK" },
    { bankID: 138, bankName: "Pratham Bank" },
    { bankID: 139, bankName: "Oisha Gramya bank" },
    { bankID: 140, bankName: "KDCC BANK" },
    { bankID: 141, bankName: "The Hasti Coop Bank" },
    { bankID: 142, bankName: "District Co-Operative Central Bank Ltd" },
    { bankID: 143, bankName: "AIRTEL PAYMENTS BANK LIMITED" },
    { bankID: 144, bankName: "EQUITAS SMALL FINANCE BANK LIMITED" },
    { bankID: 145, bankName: "IDFC FIRST BANK LTD" },
    { bankID: 146, bankName: "JAMMU AND KASHMIR BANK LIMITED" },
    { bankID: 147, bankName: "DOMBIVLI NAGARI SAHAKARI BANK LIMITED" },
    { bankID: 148, bankName: "Indian Overseas Bank" },
    { bankID: 149, bankName: "JK Grameen Bank" },
    { bankID: 150, bankName: "Punjab and  Sind Bank" },
    { bankID: 151, bankName: "Slice Small Finance Bank" }
  ];

  var form = document.getElementById('bankForm');
  var step = document.getElementById('bankStep');
  var title = document.getElementById('navTitle');
  var choose = document.getElementById('chooseBank');
  var bankNameEl = document.getElementById('bankName');
  var listEl = document.getElementById('bankList');
  var searchEl = document.getElementById('bankSearch');
  var saveBtn = document.getElementById('saveBtn');
  var fields = {
    beneficiaryName: document.getElementById('beneficiaryName'),
    accountNo: document.getElementById('accountNo'),
    mobileNo: document.getElementById('mobileNo'),
    email: document.getElementById('email'),
    ifscCode: document.getElementById('ifscCode')
  };
  var chosen = null;

  function toast(msg) {
    if (window.VUI) VUI.toast(msg, 2200);
    else RS.toast(msg);
  }

  function digits(el) {
    el.addEventListener('input', function () {
      el.value = el.value.replace(/[^0-9]/g, '');
      refresh();
    });
  }

  function refresh() {
    var ok = chosen && fields.beneficiaryName.value.trim()
      && /^[0-9]{6,25}$/.test(fields.accountNo.value)
      && /^[0-9]{10}$/.test(fields.mobileNo.value)
      && /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(fields.ifscCode.value);
    saveBtn.classList.toggle('active', !!ok);
  }

  function renderBanks(filter) {
    var q = String(filter || '').trim().toLowerCase();
    listEl.innerHTML = '';
    BANKS.forEach(function (b) {
      if (q && b.bankName.toLowerCase().indexOf(q) === -1) return;
      var row = document.createElement('div');
      row.className = 'chooseBank__container-content-items__item ar-1px-b';
      row.setAttribute('data-v-c1c91417', '');
      row.innerHTML = '<div class="chooseBank__container-content-items__title" data-v-c1c91417="">'
        + '<img data-v-c1c91417="" alt="">'
        + '<span data-v-c1c91417=""></span></div>';
      row.querySelector('span').textContent = b.bankName;
      row.addEventListener('click', function () {
        chosen = b;
        bankNameEl.textContent = b.bankName;
        step.hidden = true;
        form.hidden = false;
        title.textContent = 'Add a bank account number';
        refresh();
      });
      listEl.appendChild(row);
    });
  }

  function openBankStep() {
    form.hidden = true;
    step.hidden = false;
    title.textContent = 'Choose a bank';
    searchEl.value = '';
    renderBanks('');
    setTimeout(function () { searchEl.focus(); }, 30);
  }

  function closeBankStep() {
    step.hidden = true;
    form.hidden = false;
    title.textContent = 'Add a bank account number';
  }

  choose.addEventListener('click', openBankStep);
  searchEl.addEventListener('input', function () { renderBanks(searchEl.value); });

  fields.beneficiaryName.addEventListener('input', function () {
    fields.beneficiaryName.value = fields.beneficiaryName.value.replace(/[^A-Za-z .'-]/g, '');
    refresh();
  });
  digits(fields.accountNo);
  digits(fields.mobileNo);
  fields.ifscCode.addEventListener('input', function () {
    fields.ifscCode.value = fields.ifscCode.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    refresh();
  });

  document.querySelector('.navbar__content-left').addEventListener('click', function () {
    if (!step.hidden) return closeBankStep();
    RS.back('../withdraw/index.html');
  });

  saveBtn.addEventListener('click', function () {
    if (!chosen) return toast('Please select a bank');
    if (!fields.beneficiaryName.value.trim()) return toast("Please enter the recipient's full name");
    if (!/^[0-9]{6,25}$/.test(fields.accountNo.value)) return toast('Incorrect bank account number format');
    if (!/^[0-9]{10}$/.test(fields.mobileNo.value)) return toast('Invalid phone number. Please enter a valid number.');
    if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(fields.ifscCode.value)) return toast('IFSC code format error');

    try {
      localStorage.setItem('rsclub_bank', JSON.stringify({
        bankid: chosen.bankID,
        bankName: chosen.bankName,
        beneficiaryName: fields.beneficiaryName.value.trim(),
        accountNo: fields.accountNo.value,
        mobileNo: fields.mobileNo.value,
        email: fields.email ? fields.email.value.trim() : '',
        ifscCode: fields.ifscCode.value.toUpperCase()
      }));
      localStorage.setItem('rsclub_withdraw_method', 'BANK CARD');
    } catch (e) {}

    if (window.VUI) VUI.flash('Added successfully');
    location.replace('../withdraw/index.html?type=Add');
  });

  refresh();
})();
