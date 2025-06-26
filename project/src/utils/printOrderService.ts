import * as React from 'react';
import { createRoot } from 'react-dom/client';
import OrderCard from '../components/Order/OrderCard';

export interface OrderItem {
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface OrderCardData {
  orderNumber: string;
  customerName: string;
  bookingDate: Date;
  deliveryDate: Date;
  estimateAmount: number;
  advanceAmount: number;
  balanceAmount: number;
  items: OrderItem[];
  remarks?: string;
  prescribedBy?: string;
  bookedBy?: string;
  rightDvSph?: string;
  rightDvCyl?: string;
  rightDvAxis?: string;
  rightDvAdd?: string;
  leftDvSph?: string;
  leftDvCyl?: string;
  leftDvAxis?: string;
  leftDvAdd?: string;
  rightNvSph?: string;
  rightNvCyl?: string;
  rightNvAxis?: string;
  rightNvAdd?: string;
  leftNvSph?: string;
  leftNvCyl?: string;
  leftNvAxis?: string;
  leftNvAdd?: string;
  schemeDiscount?: string;
  rpd?: string;
  lpd?: string;
  ipd?: string;
  rightDvVn?: string;
  leftDvVn?: string;
  rightNvVn?: string;
  leftNvVn?: string;
}

export const printOrderCard = (orderData: OrderCardData) => {
  try {
    // Create a container for the print content
    const printContainer = document.createElement('div');
    printContainer.id = 'print-order-card';
    document.body.appendChild(printContainer);

    // Build the print HTML content (A4 layout, all required sections)
    const printHtml = `
      <style>
        @media print {
          @page {
            size: A4;
            margin: 18mm 12mm 18mm 12mm;
          }
          body {
            font-family: Arial, sans-serif;
            background: #fff;
            color: #222;
            margin: 0;
            padding: 0;
            font-size: 12pt;
          }
          .print-section {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
            padding: 0;
          }
          .no-print, .no-print * {
            display: none !important;
          }
        }
        .print-section {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          background: #fff;
          padding: 0;
        }
        .order-header {
          border-bottom: 2px solid #222;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        .order-title {
          text-align: center;
          font-size: 1.5em;
          font-weight: bold;
          letter-spacing: 2px;
          margin: 0;
        }
        .shop-info {
          text-align: center;
          font-size: 1.1em;
          margin-top: 2px;
          margin-bottom: 8px;
          line-height: 1.3;
        }
        .order-details-block {
          border: 1px solid #222;
          border-radius: 6px;
          padding: 10px 16px;
          margin-bottom: 12px;
          font-size: 1em;
          display: grid;
          grid-template-columns: 160px 1fr 160px 1fr;
          row-gap: 4px;
          column-gap: 8px;
        }
        .order-details-label {
          font-weight: bold;
          text-align: left;
        }
        .order-details-value {
          text-align: left;
        }
        .power-table, .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
          border-right: 2px solid #222;
        }
        .power-table th, .power-table td, .items-table th, .items-table td {
          border: 1px solid #222;
          border-right: 2px solid #222;
          padding: 4px 8px;
          text-align: center;
        }
        .power-table th {
          background: #f0f0f0;
        }
        .items-table th {
          background: #f0f0f0;
        }
        .estimate-section {
          border: 1px solid #222;
          border-radius: 6px;
          padding: 10px 16px;
          margin-bottom: 12px;
        }
        .estimate-title {
          text-align: center;
          font-size: 1.1em;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .estimate-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .footer {
          margin-top: 24px;
          font-size: 1em;
        }
        .footer .thanks {
          text-align: center;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .footer .signatory {
          text-align: right;
          font-style: italic;
        }
      </style>
      <div class="print-section" id="print-section">
        <!-- Header -->
        <div class="order-header">
          <div style="display: flex; justify-content: space-between;">
            <div style="font-size: 1em; font-weight: bold;">${formatDate(orderData.bookingDate)}</div>
            <div class="order-title">ORDER CARD</div>
            <div style="width: 100px;"></div>
          </div>
          <div class="shop-info">
            Lucky Opticians<br/>
            A.V. Building, In front of Biroba Temple, Near S.T. Stand, Karad.<br/>
            Mob No.: 9922637944
          </div>
        </div>
        <!-- Order Details Block -->
        <div class="order-details-block">
          <div class="order-details-label">Order No:</div>
          <div class="order-details-value">${orderData.orderNumber}</div>
          <div class="order-details-label">Customer Name:</div>
          <div class="order-details-value">${orderData.customerName}</div>

          <div class="order-details-label">Prescribed By:</div>
          <div class="order-details-value">${orderData.prescribedBy || ''}</div>
          <div class="order-details-label">Booked By:</div>
          <div class="order-details-value">${orderData.bookedBy || ''}</div>

          <div class="order-details-label">Booking Date/Time:</div>
          <div class="order-details-value">${formatDateTime(orderData.bookingDate)}</div>
          <div class="order-details-label">Delivery Date/Time:</div>
          <div class="order-details-value">${formatDateTime(orderData.deliveryDate)}</div>

          <div class="order-details-label">RPD:</div>
          <div class="order-details-value">${orderData.rpd || ''}</div>
          <div class="order-details-label">LPD:</div>
          <div class="order-details-value">${orderData.lpd || ''}</div>

          <div class="order-details-label">IPD:</div>
          <div class="order-details-value" style="grid-column: span 3;">${orderData.ipd || ''}</div>
        </div>
        <!-- Power Table -->
        <table class="power-table">
          <thead>
            <tr>
              <th colspan="6" style="border-right: 1px solid #222;">RIGHT</th>
              <th colspan="6">LEFT</th>
            </tr>
            <tr>
              <th></th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th><th style="border-right: 1px solid #222;">Va</th><th></th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th><th style="border-right: 1px solid #222;">Va</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>D.V.</td>
              <td>${orderData.rightDvSph || ''}</td>
              <td>${orderData.rightDvCyl || ''}</td>
              <td>${orderData.rightDvAxis || ''}</td>
              <td>${orderData.rightDvAdd || ''}</td>
              <td style="border-right: 1px solid #222;">${orderData.rightDvVn || ''}</td>
              <td>D.V.</td>
              <td>${orderData.leftDvSph || ''}</td>
              <td>${orderData.leftDvCyl || ''}</td>
              <td>${orderData.leftDvAxis || ''}</td>
              <td>${orderData.leftDvAdd || ''}</td>
              <td style="border-right: 1px solid #222;">${orderData.leftDvVn || ''}</td>
            </tr>
            <tr>
              <td>N.V.</td>
              <td>${orderData.rightNvSph || ''}</td>
              <td>${orderData.rightNvCyl || ''}</td>
              <td>${orderData.rightNvAxis || ''}</td>
              <td>${orderData.rightNvAdd || ''}</td>
              <td style="border-right: 1px solid #222;">${orderData.rightNvVn || ''}</td>
              <td>N.V.</td>
              <td>${orderData.leftNvSph || ''}</td>
              <td>${orderData.leftNvCyl || ''}</td>
              <td>${orderData.leftNvAxis || ''}</td>
              <td>${orderData.leftNvAdd || ''}</td>
              <td style="border-right: 1px solid #222;">${orderData.leftNvVn || ''}</td>
            </tr>
          </tbody>
        </table>
        <!-- Items Table -->
        <table class="items-table">
          <thead>
            <tr>
              <th>S.No.</th>
              <th>Item Name</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            ${orderData.items.map((item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.description}</td>
                <td>${item.qty}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <!-- Estimate Section -->
        <div class="estimate-section">
          <div class="estimate-title">ORDER CARD ESTIMATE</div>
          <div class="estimate-row"><span>Order No:</span><span>${orderData.orderNumber}</span></div>
          <div class="estimate-row"><span>Name:</span><span>${orderData.customerName}</span></div>
          <div class="estimate-row"><span>Estimate Amt:</span><span>₹${orderData.estimateAmount.toFixed(2)}</span></div>
          <div class="estimate-row"><span>Scheme Discount:</span><span>${orderData.schemeDiscount || ''}</span></div>
          <div class="estimate-row"><span>Advance Amt:</span><span>₹${orderData.advanceAmount.toFixed(2)}</span></div>
          <div class="estimate-row"><span>Balance Amt:</span><span>₹${orderData.balanceAmount.toFixed(2)}</span></div>
        </div>
        <!-- Footer -->
        <div class="footer">
          <div class="thanks">Thanks For Your Visit. Have A Nice Day</div>
          <div class="signatory">(Authorised Signatory)</div>
        </div>
      </div>
    `;

    printContainer.innerHTML = printHtml;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      document.body.removeChild(printContainer);
      alert('Please allow popups to print the order card.');
      return;
    }
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Order Card</title></head><body>${printHtml}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.onafterprint = function() {
        printWindow.close();
      };
      document.body.removeChild(printContainer);
    }, 400);
  } catch (error) {
    alert('Failed to generate print preview. Please try again.');
  }
};

// Helper functions for formatting
function formatDate(date: Date | string | undefined | null): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(date: Date | string | undefined | null): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
