import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const exportDashboardToPDF = async (
  dashboardElement: HTMLElement,
  dashboardName: string = 'Dashboard'
) => {
  try {
    // Create a loading indicator
    const loading = document.createElement('div');
    loading.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:20px;border-radius:8px;z-index:10000;';
    loading.textContent = 'Generating PDF...';
    document.body.appendChild(loading);

    // Wait a bit for any animations to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    const canvas = await html2canvas(dashboardElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgScaledWidth = imgWidth * ratio;
    const imgScaledHeight = imgHeight * ratio;
    
    // Center the image
    const xOffset = (pdfWidth - imgScaledWidth) / 2;
    const yOffset = (pdfHeight - imgScaledHeight) / 2;

    pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgScaledWidth, imgScaledHeight);
    
    // Add title
    pdf.setFontSize(18);
    pdf.text(dashboardName, pdfWidth / 2, 15, { align: 'center' });
    
    // Add timestamp
    pdf.setFontSize(10);
    pdf.text(`Generated on: ${new Date().toLocaleString()}`, pdfWidth / 2, pdfHeight - 10, { align: 'center' });

    pdf.save(`${dashboardName}_${Date.now()}.pdf`);
    
    document.body.removeChild(loading);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert('Failed to export PDF. Please try again.');
  }
};

