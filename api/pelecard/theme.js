/** Clinic CSS for Pelecard CssURL — full stylesheet, inlined for Vercel. */
export const CLINIC_PELECARD_CSS = `/* Maya Clinic Pelecard theme v4 — full stylesheet replacement for CssURL */
html {
    font-family: sans-serif;
    -webkit-text-size-adjust: 100%;
    -ms-text-size-adjust: 100%;
}

*, :before, :after {
    -webkit-box-sizing: border-box;
    -moz-box-sizing: border-box;
    box-sizing: border-box;
}

a:active, a:hover, a:focus {
    outline: medium none;
}

img {
    vertical-align: middle;
    border: 0 none;
}

body {
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: #333;
    background: #F3F7F4;
    margin: 0;
    padding: 0;
    direction: rtl;
    unicode-bidi: embed;
    transition: all .3s linear;
    -o-transition: all .3s linear;
    -moz-transition: all .3s linear;
    -webkit-transition: all .3s linear;
}

[hidden] {
    display: none !important;
}

form {
    margin: 0;
    padding: 0;
    display: block;
}


input, button, select, textarea {
    font-family: sans-serif;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    transition: border-color ease-in-out 0.15s, box-shadow ease-in-out 0.15s;
}
.highlighted {
    background-color: #e0e0e0;
}
.dropdown {
    position: relative;
    display: inline-block;
}

.dropdown-content {
    display: none;
    position: absolute;
    background-color: #f6f6f6;
    min-width: 100%;
    box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
    z-index: 1;
    max-height: 150px;
    overflow-y: auto;
}


    .dropdown-content a {
        color: black;
        padding: 12px 16px;
        text-decoration: none;
        display: block;
    }

        .dropdown-content a:hover {
            background-color: #ddd;
        }


button, select {
    text-transform: none;
}


.tab-button {
    position: relative;
}

.pay-logo-col {
    display: flex;
    justify-content: center;
}


.popup-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: 'Segoe UI', sans-serif;
}

.popup-content {
    background: #ffffff;
    padding: 24px 20px;
    width: 90%;
    max-width: 360px;
    border-radius: 16px;
    text-align: center;
    position: relative;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.popup-close-icon {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    background-color: #EAF8FA;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}

    .popup-close-icon .x-icon {
        font-size: 22px;
        font-weight: 500;
        color: #001C24;
        line-height: 1;
    }

.popup-title {
    font-size: 18px;
    font-weight: 600;
    color: #001C24;
    margin: 0 0 12px 0;
}

.popup-subtitle {
    font-size: 14px;
    color: #001C24;
    margin-bottom: 20px;
    line-height: 1.4;
}

.popup-qrcode-wrapper {
    background-color: #EAF8FA;
    display: inline-flex;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 24px;
}

.popup-qrcode {
    display: flex;
    justify-content: center;
    align-items: center;
}

.popup-timer {
    font-size: 13px;
    color: #001C24;
    margin-bottom: 24px;
}

.popup-timer-highlight {
    color: #007B91;
    font-weight: bold;
    margin: 0 4px;
}


.popup-link {
    display: inline-block;
    background-color: #007B91;
    color: white;
    padding: 14px 24px;
    border-radius: 9999px;
    font-weight: bold;
    font-size: 16px;
    text-decoration: none;
    transition: background-color 0.3s ease;
}

    .popup-link:hover {
        background-color: #00687a;
    }


button#openFinanceTabBtn::before {
    content: "";
    background-image: url(https://gateway20.pelecard.biz/Hosting/frame.png);
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
    background-size: 70%;
    background-repeat: no-repeat;
}

.container {
    max-width: 780px;
    padding: 0 15px;
    margin: 0 auto;
}

.main {
    border: 0;
    width: auto;
    margin: 0 auto;
}

.main-content {
    position: relative;
    margin: 0 auto;
    padding: 19px 0 5px;
}

.main-title {
    margin: 0 0 .5em;
    font-size: 1.17em;
    text-align: center;
}

    .main-title:empty {
        display: none;
    }

.clearfix:before, .clearfix:after,
.control-value:before, .control-value:after {
    display: table;
    content: " ";
}

.clearfix:after,
.control-value:after {
    clear: both;
}


.topRef {
    padding: 4px 0;
    background: #ddd;
    font-size: 11px;
    border-bottom: 1px solid #fff;
}

.credit-title {
    border-bottom: 1px solid #ddd;
    padding: 7px 0 2px;
    background-color: #f1f1f1;
    box-shadow: inset 1px -2px 5px rgba(0, 0, 0, 0.12);
}

    .credit-title .logo {
        border: 0 none;
        display: block;
        overflow: hidden;
        padding: 0;
        text-decoration: none;
        vertical-align: middle;
        /*background-image: url('../Images/Pelecard.png');*/
        background-repeat: no-repeat;
        background-size: contain;
        float: left;
        width: 230px;
        height: 110px;
    }

    .credit-title .title {
        float: right;
        font-size: 27px;
        font-weight: 500;
        margin: 17px 0 0;
        color: #2B6EAF;
        text-shadow: 1px 1px 0 rgba(255, 255, 255, 1);
    }

    .credit-title .logo img {
        max-width: 100%;
    }

#AccountNumber .form-control {
    padding: 4px 8px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
}


.errorRow {
    background-color: #BF3317;
    color: #fff;
    padding: 7px 0;
}

.footer {
    border-top: 1px solid #ddd;
    background-color: #f1f1f1;
    padding: 15px 0;
}

.footer-title {
    text-align: center;
    color: #000000;
    font-size: 16px;
    font-weight: 700;
    margin: 15px 0;
}

    .footer-title:empty {
        display: none;
    }


.form-group {
    margin-bottom: 12px;
}

.form-group-submit {
    margin: 15px 0;
}

.form-group-submit {
    text-align: center;
}

.control-label, .control-value {
}

.control-label {
    min-height: 1.2em;
    display: block;
    position: relative;
    padding-top: 4px;
    padding-bottom: 4px;
}


.credit_caption {
    height: 32px;
}

.form-control {
    display: block;
    width: 100%;
    height: 32px;
    padding: 4px 8px;
    font-size: 14px;
    line-height: 1.428571429;
    color: #000;
    vertical-align: middle;
    background-color: #f4f4f4;
    border: 1px solid #070707;
    border-radius: 1px;
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.025);
    transition: border-color ease-in-out 0.15s, box-shadow ease-in-out 0.15s, background-color ease-in-out 0.15s;
}

select.form-control {
    height: 32px;
    line-height: 32px;
}

.form-control:hover, .form-control:focus {
    border-color: #ccc;
}

.form-control:focus {
    color: #333;
    outline: 0;
    background-color: #fff;
    border-color: #03519e;
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.095), 0 0px 4px rgba(83, 137, 191, .85);
}

.form-control.read-only, .form-control.read-only:focus {
    color: #333;
    background-color: #f4f4f4;
    border: 1px solid #070707;
    box-shadow: 0 2px 2px rgba(0, 0, 0, 0.095);
    background: -moz-linear-gradient(top, #ffffff 0%, #f4f4f4 100%);
    background: -webkit-gradient(linear, left top, left bottom, color-stop(0%,#ffffff), color-stop(100%,#f4f4f4));
    background: -webkit-linear-gradient(top, #ffffff 0%,#f4f4f4 100%);
    background: -o-linear-gradient(top, #ffffff 0%,#f4f4f4 100%);
    background: -ms-linear-gradient(top, #ffffff 0%,#f4f4f4 100%);
    background: linear-gradient(to bottom, #ffffff 0%,#f4f4f4 100%);
    filter: progid:DXImageTransform.Microsoft.gradient( startColorstr='#ffffff', endColorstr='#f4f4f4',GradientType=0 );
}

div.form-control, span.form-control {
    height: auto;
    display: block;
}

.form-group, .control-group {
    display: table;
    width: 100%;
}

.control-label, .control-value {
    display: table-cell;
    vertical-align: middle;
}

.control-label {
    width: 150px;
    word-spacing: nowrap;
}

.control-value {
    padding-right: 10px;
}

.control-group .form-control, .control-group .ext {
    display: table-cell;
    vertical-align: middle;
}

.control-group .form-control {
    width: 100%;
}

.control-group .ext {
    width: 0%;
    vertical-align: middle;
    padding-right: 5px;
    color: #888;
    word-spacing: nowrap;
}

#dateContainer select.form-control, #dateContainer .delimiter {
    float: right;
}

#dateContainer select#date_month_input {
    width: 41%;
}

#dateContainer select#date_year_input {
    width: 55%;
}

#dateContainer .delimiter {
    display: block;
    width: 4%;
    text-align: center;
    line-height: 32px;
    color: #555;
    padding: 0;
}

#orderDetailsRow .control-label {
    vertical-align: top;
}

#order_details {
    overflow-y: auto;
    overflow-x: hidden;
    max-height: 5.05em;
    margin: 0 0 12px;
}

#orderDetailsRow .checkbox {
}


#credit_card_number_input, #date_month_input, #date_year_input, #id_number_input, #cvv_input, #num_of_payments, #each_payment_input, #first_payment_input, #phone_input, #email_input {
    direction: ltr;
}

#credit_card_number_input, #date_month_input, #date_year_input, #id_number_input, #cvv_input {
    text-align: left;
}

#each_payment_input, #first_payment_input, #num_of_payments, #phone_input, #email_input {
    text-align: right;
}

#each_payment_input, #first_payment_input, #totalAll {
    font-weight: 700;
}

#paymentAllRow .ext:before, #downPaymentRow .ext:before {
    content: '';
}

.radio, .checkbox {
    display: block;
    min-height: 20px;
    position: relative;
}

    .checkbox label {
        cursor: pointer;
        font-weight: 400;
        margin-bottom: 0;
        padding-right: 20px;
    }

    .checkbox input[type="checkbox"] {
        margin-right: -20px;
        position: absolute;
        line-height: normal;
        border: 1px solid #070707;
    }

.btn {
    display: inline-block;
    background-color: #ededed;
    padding: 8px 12px;
    margin-bottom: 0;
    font-size: 1em;
    font-weight: 400;
    line-height: 1.428571429;
    text-align: center;
    text-decoration: none;
    white-space: nowrap;
    vertical-align: middle;
    cursor: pointer;
    border: 1px solid #070707;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    -o-user-select: one;
    user-select: none;
    border-radius: 4px;
}

@media (min-width: 390px ) {
    .btn {
        padding: 8px 20px;
    }
}

.btn-submit {
    margin: 0 auto;
    font-size: 1.0231em;
    border-color: #070707;
    color: #322e00;
    text-shadow: 0 1px 1px rgba(255,255,255,.9);
    font-weight: bold;
    background: #5D7F6D;
    background: -moz-linear-gradient(top, #6F9180 23%, #5D7F6D 80%);
    background: -webkit-gradient(linear, left top, left bottom, color-stop(23%,#6F9180), color-stop(80%,#5D7F6D));
    background: -webkit-linear-gradient(top, #6F9180 23%,#5D7F6D 80%);
    background: -o-linear-gradient(top, #6F9180 23%,#5D7F6D 80%);
    background: -ms-linear-gradient(top, #6F9180 23%,#5D7F6D 80%);
    background: linear-gradient(to bottom, #6F9180 23%,#5D7F6D 80%);
    filter: progid:DXImageTransform.Microsoft.gradient( startColorstr='#6F9180', endColorstr='#5D7F6D',GradientType=0 );
}

    .btn-submit:hover, .btn-submit:focus {
        background: #5D7F6D;
        background: -moz-linear-gradient(top, #6F9180 34%, #5D7F6D 66%);
        background: -webkit-gradient(linear, left top, left bottom, color-stop(34%,#6F9180), color-stop(66%,#5D7F6D));
        background: -webkit-linear-gradient(top, #6F9180 34%,#5D7F6D 66%);
        background: -o-linear-gradient(top, #6F9180 34%,#5D7F6D 66%);
        background: -ms-linear-gradient(top, #6F9180 34%,#5D7F6D 66%);
        background: linear-gradient(to bottom, #6F9180 34%,#5D7F6D 66%);
        filter: progid:DXImageTransform.Microsoft.gradient( startColorstr='#6F9180', endColorstr='#5D7F6D',GradientType=0 );
    }

.paypalText {
    margin-right: 100px;
    margin-bottom: 10px;
}

.masterpassLearnMore {
    text-align: left;
    padding-left: 140px;
}

.btn-masterpass {
    background-image: url("https://www.mastercard.com/mc_us/wallet/img/en/US/mcpp_wllt_btn_chk_160x037px.png");
    margin-left: 5px;
    width: 157px;
    height: 37px;
}

.btn-submit:hover, .btn-submit:focus {
    border-color: #999;
}

.btn-submit:focus {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.154) inset;
}

.btn-paypal {
    margin: 0 auto;
    font-size: 1.0231em;
    border-color: #888;
    color: #fff;
    text-shadow: 0 1px 1px rgba(0,0,0,.5);
    font-weight: bold;
    background: #3990e4;
    background: -moz-linear-gradient(top, #3990e4 23%, #2275c4 80%);
    background: -webkit-gradient(linear, left top, left bottom, color-stop(23%,#3990e4), color-stop(80%,#2275c4));
    background: -webkit-linear-gradient(top, #3990e4 23%,#2275c4 80%);
    background: -o-linear-gradient(top, #3990e4 23%,#2275c4 80%);
    background: -ms-linear-gradient(top, #3990e4 23%,#2275c4 80%);
    background: linear-gradient(to bottom, #3990e4 23%,#2275c4 80%);
    filter: progid:DXImageTransform.Microsoft.gradient( startColorstr='#3990e4', endColorstr='#2275c4',GradientType=0 );
}

    .btn-paypal:hover, .btn-paypal:focus {
        background: #3990e4;
        background: -moz-linear-gradient(top, #3990e4 34%, #2275c4 66%);
        background: -webkit-gradient(linear, left top, left bottom, color-stop(34%,#3990e4), color-stop(66%,#2275c4));
        background: -webkit-linear-gradient(top, #3990e4 34%,#2275c4 66%);
        background: -o-linear-gradient(top, #3990e4 34%,#2275c4 66%);
        background: -ms-linear-gradient(top, #3990e4 34%,#2275c4 66%);
        background: linear-gradient(to bottom, #3990e4 34%,#2275c4 66%);
        filter: progid:DXImageTransform.Microsoft.gradient( startColorstr='#3990e4', endColorstr='#2275c4',GradientType=0 );
    }

.form-group-submit-in .btn {
    margin-bottom: 8px;
    height: 40px;
}

    .form-group-submit-in .btn + .btn {
        margin-right: 5px;
    }


.lnk-toggle {
    cursor: pointer;
    vertical-align: middle;
}

    .lnk-toggle:before {
        content: '+';
        display: inline-block;
        font-weight: 700;
        line-height: 14px;
        font-size: 14px;
        padding: 2px 5px;
        color: #2b6eaf;
        border: 1px solid #ddd;
        background: #ededed;
        background: -moz-linear-gradient(top, #ededed 0%, #dddddd 100%);
        background: -webkit-gradient(linear, left top, left bottom, color-stop(0%,#ededed), color-stop(100%,#dddddd));
        background: -webkit-linear-gradient(top, #ededed 0%,#dddddd 100%);
        background: -o-linear-gradient(top, #ededed 0%,#dddddd 100%);
        background: -ms-linear-gradient(top, #ededed 0%,#dddddd 100%);
        background: linear-gradient(to bottom, #ededed 0%,#dddddd 100%);
        filter: progid:DXImageTransform.Microsoft.gradient( startColorstr='#ededed', endColorstr='#dddddd',GradientType=0 );
    }


    .lnk-toggle:hover:before {
        border-color: #999;
        color: #282828;
    }

    .active .lnk-toggle:before,
    .lnk-toggle.active:before {
        content: '-';
    }

.ic-p, .form-group-sup-in > div, .form-group-sup-in > a {
    border: 0 none;
    display: inline-block;
    overflow: hidden;
    padding: 0;
    text-decoration: none;
    vertical-align: middle;
    background-repeat: no-repeat;
    background-size: contain;
}

.info-ic {
    cursor: pointer;
    position: absolute;
    top: 50%;
    left: 0px;
    margin-top: -8px;
    width: 16px;
    height: 16px;
    background-image: url('../Images/icon_info.png');
}

.star-ic {
    width: 14px;
    height: 14px;
    background-image: url('../Images/star.png');
    vertical-align: top;
}

.clear-ic {
    cursor: pointer;
    position: absolute;
    top: 50%;
    left: 0px;
    margin-top: -10px;
    width: 20px;
    height: 20px;
    background-image: url('../Images/file_delete.png');
}

.ssl-ic {
    width: 16px;
    height: 16px;
    background-image: url('../Images/ssl-ic.png');
}

.form-group-sup {
    max-width: 450px;
    margin: 0 auto;
    padding: 4px;
    text-align: center;
}

.form-group-sup-1 {
    margin-bottom: 7px;
    padding-bottom: 0;
}

.form-group-sup .title {
    margin: 0 0 .01em;
    font-size: .92em;
    color: #2b6eaf;
}

.form-group-sup-in {
    overflow: hidden;
}

    .form-group-sup-in img {
        max-width: 100%;
    }

.form-group-sup-1 .form-group-sup-in > div {
    width: 16%;
    max-width: 64px;
    height: 64px;
    margin: 0 1%;
}

.form-group-sup-2 .form-group-sup-in > div img {
    display: none;
}

.sup-in-ic-1 {
    background-image: url('../Images/Visa.png');
}

.sup-in-ic-2 {
    background-image: url('../Images/Mastercard.png');
}

.sup-in-ic-3 {
    background-image: url('../Images/Amex.png');
}

.sup-in-ic-4 {
    background-image: url('../Images/Diners.png');
}

.sup-in-ic-5 {
    background-image: url('../Images/israCard.png');
}

.sup-lg-ic-1 {
    background-image: url('../Images/pci.png');
}

.sup-lg-ic-2 {
    background-image: url('../Images/thawte.png');
}

.sup-lg-ic-3 {
    background-image: url('../Images/pelecards.png');
}

.form-group-sup-2 .form-group-sup-in > a {
    width: 30%;
    margin: 0 1%;
    max-width: 120px;
    height: 55px;
}


/*grid*/
.row {
    margin-right: -7px;
    margin-left: -7px;
}

    .row:before, .row:after {
        display: table;
        content: " ";
    }

    .row:after {
        clear: both;
    }

    .row:before, .row:after {
        display: table;
        content: " ";
    }

    .row:after {
        clear: both;
    }

.col-sm-1, .col-sm-2, .col-sm-3, .col-sm-4, .col-sm-5, .col-sm-6, .col-sm-7, .col-sm-8, .col-sm-9, .col-sm-10, .col-sm-11, .col-sm-12 {
    position: relative;
    min-height: 1px;
    padding-right: 7px;
    padding-left: 7px;
    float: right;
}

.col-sm-1 {
    width: 8.333333333333332%;
}

.col-sm-2 {
    /*width: 16.666666666666664%;*/
    width: 20%;
}


.col-sm-3 {
    width: 25%;
}

.col-sm-4 {
    width: 33.33333333333333%;
}

.col-sm-5 {
    width: 41.66666666666667%;
}

.col-sm-6 {
    width: 50%;
}

.col-sm-7 {
    width: 58.333333333333336%;
}

.col-sm-8 {
    width: 66.66666666666666%;
}

.col-sm-9 {
    width: 75%;
}

.col-sm-10 {
    width: 83.33333333333334%;
}

.col-sm-11 {
    width: 91.66666666666666%;
}

.col-sm-12 {
    width: 100%;
}

@media (max-width: 750px) {
    .col-sm-1, .col-sm-2, .col-sm-3, .col-sm-4, .col-sm-5, .col-sm-6, .col-sm-7, .col-sm-8, .col-sm-9, .col-sm-10, .col-sm-11, .col-sm-12 {
        float: none;
        width: 100%;
    }

    .credit-title .logo {
        float: none;
        width: 150px;
        height: 59px;
        margin: 0 auto;
    }

    .credit-title .title {
        float: none;
        font-size: 23px;
        margin: 0 0 10px 0;
        text-align: center;
    }

    #paymentsNo, #paymentAll, #downPayment {
        /*max-width:230px;*/
    }

    button#openFinanceTabBtn::before {
        background-size: 20%;
    }
}

@media (min-width: 750px) {
    .form-group {
        margin-bottom: 15px;
    }

    #creditCardExpDateRow .control-label {
        width: 100px;
    }

    #downPaymentRow .control-label,
    #paymentAllRow .control-label {
        width: 90px;
        text-align: left;
    }

    #cvvRow .control-label {
        width: 160px;
    }
}

@media (max-width: 400px) {
    .credit-title .title {
        font-size: 19px;
    }

    .control-label, .control-value {
        display: block;
        vertical-align: middle;
    }

    .control-label {
        width: auto;
        word-spacing: normal;
        padding: 0;
        margin: 0 0 5px;
    }

    .control-value {
        padding: 0;
        vertical-align: top;
    }

    .star-ic {
        vertical-align: top;
    }

    .form-group-sup-1 .form-group-sup-in > div {
        height: 40px;
    }

    .form-group-sup-2 .form-group-sup-in > a {
        height: 44px;
    }
}

/* omri added - also made changes with the ID's of the inputs*/
.block_ui_container {
    position: relative;
    width: 200px;
}

.block_ui_text {
    position: absolute;
    top: 40px;
    left: 60px;
    font-size: 32px;
    color: #000066;
    font-weight: bold;
}

.block_ui_text_pp {
    position: absolute;
    top: 39px;
    left: 25px;
    font-size: 23px;
    color: #035b3b;
    font-weight: bold;
}

.block_ui_text_gama {
    position: absolute;
    top: 50px;
    left: 0px;
    font-size: 14px;
    color: #035b3b;
    font-weight: bold;
    margin: 15px;
}

.block_ui_background {
    z-index: -1;
    width: 200px;
}

.block_ui_background_heigth1 {
    z-index: -1;
    width: 200px;
    height: 190px;
}

.block_ui_loader {
    position: absolute;
    top: 40px;
    left: 50px;
    width: 100px
}

a:focus {
    outline-style: dotted;
    outline-width: 2px;
}

.apple-pay-button {
    height: 40px;
    margin: 0;
}

button#info:focus, button#info:hover {
    background-color: lightgray;
}

.modal-box {
    width: 320px;
    height: 249px;
}


.red-field {
    border: #C00000 2px solid;
}

p.block_ui_cancel_gama {
    position: absolute;
    top: 115px;
    border: 1px;
    font-size: 14px;
    color: #035b3b;
    font-weight: bold;
    margin: 15px;
    cursor: pointer;
    background: #BF3317;
    color: #fff;
    border-radius: 5px;
    width: 100px;
    padding: 5px;
    left: 40px;
}


/* ==== Maya Clinic brand overrides (v5 — iframe mobile) ==== */
html {
  font-family: Heebo, "Segoe UI", Tahoma, Arial, sans-serif !important;
  color: #2F3B34 !important;
  -webkit-text-size-adjust: 100% !important;
  text-size-adjust: 100% !important;
}

html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  overflow-x: hidden !important;
  background: #ffffff !important;
}

body {
  font-family: Heebo, "Segoe UI", Tahoma, Arial, sans-serif !important;
  color: #2F3B34 !important;
  padding-bottom: 48px !important;
}

*,
*::before,
*::after {
  box-sizing: border-box !important;
}

img,
svg,
video,
canvas {
  max-width: 100% !important;
  height: auto !important;
}

/* ==== Wallet-only checkout: Apple Pay + Google Pay logos ==== */

/* Hide manual credit-card entry + green submit (wallets launch native sheets) */
#AccountNumber,
#creditCardExpDateRow,
#cvvRow,
#totalAllRow,
#paymentsNo,
#paymentAll,
#downPayment,
#downPaymentRow,
#paymentAllRow,
#credit_card_number_input,
#date_month_input,
#date_year_input,
#dateContainer,
#cvv_input,
#id_number_input,
#totalAll,
#num_of_payments,
#each_payment_input,
#first_payment_input,
.form-group:has(#credit_card_number_input),
.form-group:has(#cvv_input),
.form-group:has(#totalAll),
.form-group:has(#date_month_input),
.form-group:has(#dateContainer),
.form-group:has(#id_number_input),
.control-group:has(#credit_card_number_input),
.control-group:has(#cvv_input),
.control-group:has(#totalAll),
.control-group:has(#date_month_input),
.control-group:has(#dateContainer),
.control-group:has(#id_number_input),
.form-group-submit,
.form-group-submit-in,
.btn-submit,
button.btn-submit,
input.btn-submit,
#submit,
#submitBtn,
.form-group-submit button[type="submit"],
.form-group-submit input[type="submit"],
button#info,
.form-group-sup,
.form-group-sup-1,
.form-group-sup-2 {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  max-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  border: 0 !important;
}

/* Remaining method tiles (Apple / Google) — logo only, centered */
.pay-logo-col,
.tab-button,
.tab-button > button,
.pay-logo-col button,
.body-content button.tab-button,
#GooglePayButton,
#ApplePayButton,
[id*="GooglePay"],
[id*="ApplePay"],
[id*="googlePay"],
[id*="applePay"],
[class*="google-pay"],
[class*="apple-pay"],
[class*="GooglePay"],
[class*="ApplePay"],
[class*="payment-method"] button,
[class*="PaymentMethod"] button,
.apple-pay-button,
apple-pay-button,
button.apple-pay-button {
  display: flex !important;
  visibility: visible !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0 !important;
  box-sizing: border-box !important;
  width: 100% !important;
  max-width: 100% !important;
  min-height: 64px !important;
  height: 64px !important;
  max-height: 72px !important;
  margin: 10px 0 !important;
  padding: 0 20px !important;
  overflow: hidden !important;
  line-height: 0 !important;
  text-align: center !important;
  font-size: 0 !important;
  color: transparent !important;
  letter-spacing: 0 !important;
  background-position: center center !important;
  background-repeat: no-repeat !important;
  background-size: auto 36px !important;
  --apple-pay-button-height: 64px;
  --apple-pay-button-border-radius: 14px;
  --apple-pay-button-padding: 0px;
  --apple-pay-button-box-sizing: border-box;
}

/* Hide text labels inside wallet tiles; keep logo media */
.pay-logo-col > span:not(:has(img)):not(:has(svg)),
.tab-button > span:not(:has(img)):not(:has(svg)),
.tab-button > button > span:not(:has(img)):not(:has(svg)),
.pay-logo-col button > span:not(:has(img)):not(:has(svg)),
.body-content button.tab-button > span:not(:has(img)):not(:has(svg)),
#GooglePayButton > span:not(:has(img)):not(:has(svg)),
#ApplePayButton > span:not(:has(img)):not(:has(svg)),
[id*="GooglePay"] > span:not(:has(img)):not(:has(svg)),
[id*="ApplePay"] > span:not(:has(img)):not(:has(svg)),
[class*="google-pay"] > span:not(:has(img)):not(:has(svg)),
[class*="apple-pay"] > span:not(:has(img)):not(:has(svg)),
[class*="payment-method"] button > span:not(:has(img)):not(:has(svg)),
[class*="PaymentMethod"] button > span:not(:has(img)):not(:has(svg)) {
  display: none !important;
}

.pay-logo-col img,
.pay-logo-col svg,
.pay-logo-col button img,
.pay-logo-col button svg,
.tab-button img,
.tab-button svg,
.tab-button > button img,
.tab-button > button svg,
.body-content button.tab-button img,
.body-content button.tab-button svg,
#GooglePayButton img,
#GooglePayButton svg,
#ApplePayButton img,
#ApplePayButton svg,
[id*="GooglePay"] img,
[id*="GooglePay"] svg,
[id*="ApplePay"] img,
[id*="ApplePay"] svg,
[id*="googlePay"] img,
[id*="applePay"] img,
[class*="google-pay"] img,
[class*="apple-pay"] img,
[class*="GooglePay"] img,
[class*="ApplePay"] img,
[class*="payment-method"] button img,
[class*="PaymentMethod"] button img {
  display: block !important;
  flex: 0 0 auto !important;
  width: auto !important;
  max-width: 160px !important;
  height: 36px !important;
  max-height: 36px !important;
  margin: 0 auto !important;
  object-fit: contain !important;
  object-position: center !important;
  position: static !important;
  float: none !important;
  transform: none !important;
  font-size: 16px !important;
  color: initial !important;
}

/* Hide credit-card tile after wallet show-rules (must win cascade) */
.tab-button:has(img[src*="Visa" i], img[src*="visa" i], img[src*="Master" i], img[src*="master" i], img[src*="Mastercard" i], img[src*="mastercard" i], img[src*="Isracard" i], img[src*="isracard" i], img[alt*="Visa" i], img[alt*="Master" i], img[alt*="אשראי" i]):not(:has(img[src*="Apple" i], img[src*="apple" i], img[src*="Google" i], img[src*="google" i], img[alt*="Apple" i], img[alt*="Google" i])),
.pay-logo-col:has(img[src*="Visa" i], img[src*="visa" i], img[src*="Master" i], img[src*="master" i], img[src*="Mastercard" i], img[src*="mastercard" i], img[src*="Isracard" i], img[src*="isracard" i], img[alt*="Visa" i], img[alt*="Master" i], img[alt*="אשראי" i]):not(:has(img[src*="Apple" i], img[src*="apple" i], img[src*="Google" i], img[src*="google" i], img[alt*="Apple" i], img[alt*="Google" i], [id*="ApplePay"], [id*="GooglePay"])),
button.tab-button:has(img[src*="Visa" i], img[src*="Master" i], img[src*="mastercard" i], img[src*="visa" i]),
.body-content .tab-button:has(img[src*="Visa" i], img[src*="Master" i], img[src*="mastercard" i], img[src*="visa" i]),
/* When credit + Apple + Google are siblings, credit is first */
.pay-logo-col:first-child:has(+ .pay-logo-col + .pay-logo-col),
.tab-button:first-of-type:has(~ .tab-button ~ .tab-button),
.body-content button.tab-button:first-of-type:has(~ button.tab-button ~ button.tab-button) {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  min-height: 0 !important;
  max-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  overflow: hidden !important;
  pointer-events: none !important;
}

.body-content {
  background: #ffffff !important;
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
}

.container {
  max-width: 100% !important;
  width: 100% !important;
  margin: 0 auto !important;
  padding: 0 14px !important;
}

.main {
  background: #ffffff !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  overflow: visible !important;
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
}

.credit-title,
.topRef {
  background: #F7FAF8 !important;
  border-bottom: 1px solid #E8ECE8 !important;
  box-shadow: none !important;
  padding: 8px 0 !important;
}

.credit-title .title,
.main-title,
.form-group-sup .title {
  color: #5D7F6D !important;
  text-shadow: none !important;
  font-weight: 700 !important;
  font-size: 15px !important;
  margin: 0 !important;
  float: none !important;
  text-align: center !important;
  width: 100% !important;
}

.credit-title .logo { display: none !important; }

.form-control,
input.form-control,
select.form-control,
input[type="text"],
input[type="tel"],
input[type="number"],
input[type="password"],
select {
  height: 44px !important;
  border: 1px solid #E8ECE8 !important;
  border-radius: 12px !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03) !important;
  background: #FFFFFF !important;
  background-image: none !important;
  filter: none !important;
  color: #2F3B34 !important;
}

.form-control.read-only,
.form-control[readonly],
input[readonly] {
  background: #F0F4F1 !important;
  color: #5D7F6D !important;
  font-weight: 700 !important;
}

#totalAll,
#each_payment_input,
#first_payment_input {
  color: #5D7F6D !important;
  font-weight: 700 !important;
}

/* Stack label above field — never side-by-side table layout */
.form-group,
.control-group {
  display: block !important;
  width: 100% !important;
  margin-bottom: 12px !important;
}

.control-label,
.control-value {
  display: block !important;
  width: 100% !important;
  float: none !important;
  padding: 0 !important;
  min-height: 0 !important;
}

.control-label {
  margin: 0 0 6px !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  color: #2F3B34 !important;
  text-align: right !important;
  position: static !important;
  left: auto !important;
  right: auto !important;
}

.control-value {
  margin: 0 !important;
  position: static !important;
  width: 100% !important;
}

.control-group .form-control,
.form-control,
input.form-control,
select.form-control,
#AccountNumber .form-control,
#credit_card_number_input,
#id_number_input,
#cvv_input,
#totalAll,
input[name*="credit"],
input[name*="Credit"],
input[id*="credit"],
input[id*="Credit"],
input[id*="card"],
input[id*="Card"] {
  float: none !important;
  clear: both !important;
  position: static !important;
  left: auto !important;
  right: auto !important;
  display: block !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
  margin: 0 0 4px !important;
}

/* Keep focused field scrollable above soft keyboard */
input.form-control:focus,
select.form-control:focus,
#credit_card_number_input:focus,
#cvv_input:focus {
  scroll-margin-bottom: 240px !important;
  scroll-margin-top: 80px !important;
}

#dateContainer {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 8px !important;
  width: 100% !important;
}

#dateContainer select.form-control,
#dateContainer select#date_month_input,
#dateContainer select#date_year_input {
  float: none !important;
  flex: 1 1 0 !important;
  width: auto !important;
  max-width: none !important;
}

#dateContainer .delimiter {
  float: none !important;
  width: auto !important;
  line-height: 44px !important;
  padding: 0 2px !important;
}

.row {
  margin-left: 0 !important;
  margin-right: 0 !important;
}

.col-sm-1, .col-sm-2, .col-sm-3, .col-sm-4, .col-sm-5, .col-sm-6,
.col-sm-7, .col-sm-8, .col-sm-9, .col-sm-10, .col-sm-11, .col-sm-12 {
  float: none !important;
  width: 100% !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
}

.form-group-submit,
.form-group-submit-in {
  text-align: center !important;
  display: block !important;
  visibility: visible !important;
  position: relative !important;
  z-index: 6 !important;
  clear: both !important;
  margin: 16px 0 8px !important;
  padding: 8px 0 20px !important;
  background: transparent !important;
}

/* Hide empty / secondary ghost buttons that became a second green bar */
.form-group-submit-in .btn + .btn,
.form-group-submit .btn:empty,
.form-group-submit-in .btn:empty,
.form-group-submit button:empty,
.form-group-submit-in button:empty,
.form-group-submit input.btn:not(.btn-submit):not([type="submit"]),
.form-group-submit-in input.btn:not(.btn-submit):not([type="submit"]) {
  display: none !important;
}

/* Only the real submit CTA — do NOT restyle every .btn (causes blank green button) */
.btn-submit,
button.btn-submit,
input.btn-submit,
#submit,
#submitBtn,
.form-group-submit button[type="submit"],
.form-group-submit input[type="submit"],
.form-group-submit-in button[type="submit"],
.form-group-submit-in input[type="submit"] {
  width: 100% !important;
  max-width: 100% !important;
  min-height: 52px !important;
  height: auto !important;
  display: block !important;
  margin: 0 auto !important;
  padding: 14px 20px !important;
  border: 0 !important;
  border-radius: 16px !important;
  color: #FFFFFF !important;
  font-family: Heebo, "Segoe UI", Tahoma, Arial, sans-serif !important;
  font-size: 1.1rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.03em !important;
  line-height: 1.2 !important;
  text-align: center !important;
  text-decoration: none !important;
  text-shadow: none !important;
  background: #5D7F6D !important;
  background-image:
    linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 42%),
    linear-gradient(135deg, #6F9180 0%, #5D7F6D 48%, #4F6F5F 100%) !important;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.28) inset,
    0 10px 28px rgba(93,127,109,0.28),
    0 2px 6px rgba(47,59,52,0.12) !important;
  filter: none !important;
  cursor: pointer !important;
  -webkit-appearance: none !important;
  appearance: none !important;
}

.btn-submit:hover,
.btn-submit:focus,
button.btn-submit:hover,
button.btn-submit:focus,
#submitBtn:hover,
#submitBtn:focus,
.form-group-submit button[type="submit"]:hover,
.form-group-submit button[type="submit"]:focus {
  background: #4F6F5F !important;
  color: #FFFFFF !important;
  outline: none !important;
}

.footer {
  background: transparent !important;
  border-top: 0 !important;
  padding: 8px 0 16px !important;
}

/* Mobile polish */
@media (max-width: 750px) {
  html, body {
    min-height: auto !important;
    height: auto !important;
    max-height: none !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    padding-bottom: 16px !important;
  }

  .body-content,
  .container,
  .main,
  .main-content,
  form {
    max-height: none !important;
    height: auto !important;
    overflow: visible !important;
  }

  .container {
    max-width: 100% !important;
    padding: 0 12px 40px !important;
  }

  .main {
    border-radius: 14px !important;
    box-shadow: none !important;
    border: 0 !important;
    background: #fff !important;
  }

  .main-content {
    padding: 8px 0 20px !important;
  }

  .credit-title {
    padding: 8px 0 !important;
  }

  .credit-title .title,
  .main-title {
    font-size: 15px !important;
    margin: 2px 0 !important;
  }

  .topRef {
    display: none !important;
  }

  .form-group-sup,
  .form-group-sup-1,
  .form-group-sup-2 {
    display: none !important;
  }

  .form-group,
  .control-group {
    margin-bottom: 10px !important;
  }

  .control-label {
    margin: 0 0 4px !important;
    font-size: 12px !important;
  }

  .form-control,
  input.form-control,
  select.form-control,
  input[type="text"],
  input[type="tel"],
  input[type="number"],
  input[type="password"],
  select {
    height: 44px !important;
    border-radius: 12px !important;
  }

  /* Wallet-only — keep logo tiles large and centered on mobile */
  #GooglePayButton,
  #ApplePayButton,
  [id*="GooglePay"],
  [id*="ApplePay"],
  [id*="googlePay"],
  [id*="applePay"],
  [class*="google-pay"],
  [class*="apple-pay"],
  [class*="GooglePay"],
  [class*="ApplePay"],
  .apple-pay-button,
  apple-pay-button,
  button.apple-pay-button,
  .tab-button:has(img[src*="Apple" i], img[src*="apple" i], img[src*="Google" i], img[src*="google" i], img[alt*="Apple" i], img[alt*="Google" i]),
  .pay-logo-col button:has(img[src*="Apple" i], img[src*="apple" i], img[src*="Google" i], img[src*="google" i], img[alt*="Apple" i], img[alt*="Google" i]) {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-height: 64px !important;
    height: 64px !important;
    margin: 10px 0 !important;
    padding: 0 20px !important;
    font-size: 0 !important;
    line-height: 0 !important;
    width: 100% !important;
  }

  #GooglePayButton img,
  #ApplePayButton img,
  [id*="GooglePay"] img,
  [id*="ApplePay"] img,
  [class*="google-pay"] img,
  [class*="apple-pay"] img,
  [class*="GooglePay"] img,
  [class*="ApplePay"] img,
  .tab-button:has(img[src*="Apple" i], img[src*="apple" i], img[src*="Google" i], img[src*="google" i], img[alt*="Apple" i], img[alt*="Google" i]) img,
  .pay-logo-col button:has(img[src*="Apple" i], img[src*="apple" i], img[src*="Google" i], img[src*="google" i], img[alt*="Apple" i], img[alt*="Google" i]) img {
    width: auto !important;
    max-width: 160px !important;
    height: 36px !important;
    max-height: 36px !important;
    margin: 0 auto !important;
    object-fit: contain !important;
  }

  /* Any absolute/float leftovers from Pelecard base CSS */
  .form-group,
  .control-group,
  .control-label,
  .control-value,
  .form-control,
  input,
  select {
    float: none !important;
    position: static !important;
  }

  .form-group-submit,
  .form-group-submit-in {
    margin: 12px 0 0 !important;
    padding: 8px 0 24px !important;
    box-shadow: none !important;
    background: transparent !important;
  }

  .btn-submit,
  button.btn-submit,
  input.btn-submit,
  #submit,
  #submitBtn,
  .form-group-submit button[type="submit"],
  .form-group-submit input[type="submit"] {
    min-height: 52px !important;
    padding: 14px 16px !important;
    font-size: 1.05rem !important;
    border-radius: 14px !important;
  }
}
`;

/**
 * GET /api/pelecard/theme
 * Public CssURL endpoint for Pelecard ManualIframe branding.
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.status(204).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.setHeader("Content-Type", "text/css; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=30, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("X-Clinic-Theme", "v4-btn");
  res.status(200).send(req.method === "HEAD" ? "" : CLINIC_PELECARD_CSS);
}
