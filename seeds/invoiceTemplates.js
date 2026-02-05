const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const InvoiceTemplate = require('../models/InvoiceTemplate');

const templates = [
  {
    name: 'Modern',
    description: 'Clean, minimalist design with bold typography and modern aesthetic',
    type: 'modern',
    layout: {
      headerSection: {
        show: true,
        logoPosition: 'left',
        showCompanyDetails: true
      },
      bodySection: {
        showProductImages: false,
        showProductSKU: true,
        itemTableStyle: 'minimal'
      },
      footerSection: {
        show: true,
        showFooterLogo: false,
        logoPosition: 'center'
      }
    },
    colorScheme: {
      primaryColor: '#4F46E5', // Indigo
      secondaryColor: '#9333EA', // Purple
      accentColor: '#10B981', // Green
      textColor: '#1F2937', // Gray-800
      backgroundColor: '#FFFFFF'
    },
    fonts: {
      headingFont: 'Inter',
      bodyFont: 'Inter',
      headingSize: '32px',
      bodySize: '14px'
    },
    sections: {
      showCompanyAddress: true,
      showTaxInfo: true,
      showPaymentTerms: true,
      showNotes: true,
      showBankDetails: false,
      showSignature: true,
      showQRCode: false
    },
    customFields: [],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Classic',
    description: 'Traditional invoice design with formal layout and professional appearance',
    type: 'classic',
    layout: {
      headerSection: {
        show: true,
        logoPosition: 'right',
        showCompanyDetails: true
      },
      bodySection: {
        showProductImages: false,
        showProductSKU: true,
        itemTableStyle: 'bordered'
      },
      footerSection: {
        show: true,
        showFooterLogo: false,
        logoPosition: 'left'
      }
    },
    colorScheme: {
      primaryColor: '#1E3A8A', // Blue-900
      secondaryColor: '#475569', // Slate-600
      accentColor: '#059669', // Emerald-600
      textColor: '#0F172A', // Slate-900
      backgroundColor: '#F8FAFC'
    },
    fonts: {
      headingFont: 'Georgia',
      bodyFont: 'Georgia',
      headingSize: '28px',
      bodySize: '14px'
    },
    sections: {
      showCompanyAddress: true,
      showTaxInfo: true,
      showPaymentTerms: true,
      showNotes: true,
      showBankDetails: true,
      showSignature: true,
      showQRCode: false
    },
    customFields: [],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Minimal',
    description: 'Simple, text-focused design with maximum clarity and minimal distractions',
    type: 'minimal',
    layout: {
      headerSection: {
        show: true,
        logoPosition: 'center',
        showCompanyDetails: true
      },
      bodySection: {
        showProductImages: false,
        showProductSKU: false,
        itemTableStyle: 'minimal'
      },
      footerSection: {
        show: false,
        showFooterLogo: false,
        logoPosition: 'center'
      }
    },
    colorScheme: {
      primaryColor: '#000000', // Black
      secondaryColor: '#6B7280', // Gray-500
      accentColor: '#111827', // Gray-900
      textColor: '#374151', // Gray-700
      backgroundColor: '#FFFFFF'
    },
    fonts: {
      headingFont: 'Helvetica',
      bodyFont: 'Helvetica',
      headingSize: '24px',
      bodySize: '12px'
    },
    sections: {
      showCompanyAddress: true,
      showTaxInfo: false,
      showPaymentTerms: true,
      showNotes: false,
      showBankDetails: false,
      showSignature: false,
      showQRCode: false
    },
    customFields: [],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Professional',
    description: 'Corporate look with subtle colors and professional polish',
    type: 'professional',
    layout: {
      headerSection: {
        show: true,
        logoPosition: 'left',
        showCompanyDetails: true
      },
      bodySection: {
        showProductImages: false,
        showProductSKU: true,
        itemTableStyle: 'striped'
      },
      footerSection: {
        show: true,
        showFooterLogo: true,
        logoPosition: 'center'
      }
    },
    colorScheme: {
      primaryColor: '#0F766E', // Teal-700
      secondaryColor: '#64748B', // Slate-500
      accentColor: '#14B8A6', // Teal-500
      textColor: '#1E293B', // Slate-800
      backgroundColor: '#FFFFFF'
    },
    fonts: {
      headingFont: 'Arial',
      bodyFont: 'Arial',
      headingSize: '26px',
      bodySize: '13px'
    },
    sections: {
      showCompanyAddress: true,
      showTaxInfo: true,
      showPaymentTerms: true,
      showNotes: true,
      showBankDetails: true,
      showSignature: true,
      showQRCode: true
    },
    customFields: [],
    status: 'active',
    isSystem: true
  },
  {
    name: 'Creative',
    description: 'Colorful design with visual elements and modern styling',
    type: 'corporate',
    layout: {
      headerSection: {
        show: true,
        logoPosition: 'center',
        showCompanyDetails: true
      },
      bodySection: {
        showProductImages: true,
        showProductSKU: true,
        itemTableStyle: 'bordered'
      },
      footerSection: {
        show: true,
        showFooterLogo: true,
        logoPosition: 'center'
      }
    },
    colorScheme: {
      primaryColor: '#DC2626', // Red-600
      secondaryColor: '#F97316', // Orange-500
      accentColor: '#FBBF24', // Amber-400
      textColor: '#18181B', // Zinc-900
      backgroundColor: '#FFFBEB'
    },
    fonts: {
      headingFont: 'Verdana',
      bodyFont: 'Verdana',
      headingSize: '30px',
      bodySize: '14px'
    },
    sections: {
      showCompanyAddress: true,
      showTaxInfo: true,
      showPaymentTerms: true,
      showNotes: true,
      showBankDetails: false,
      showSignature: true,
      showQRCode: true
    },
    customFields: [
      {
        name: 'project',
        label: 'Project Name',
        type: 'text',
        required: false,
        placeholder: 'Enter project name',
        position: 'header'
      },
      {
        name: 'po_number',
        label: 'PO Number',
        type: 'text',
        required: false,
        placeholder: 'Purchase Order Number',
        position: 'header'
      }
    ],
    status: 'active',
    isSystem: true
  }
];

async function seedInvoiceTemplates() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');

    // Check if templates already exist
    const existingCount = await InvoiceTemplate.countDocuments({ isSystem: true });
    
    if (existingCount > 0) {
      console.log(`Found ${existingCount} existing system templates.`);
      console.log('Do you want to replace them? (Y/N)');
      
      // For automated seeding, we'll skip if templates exist
      // In production, you might want to add interactive prompt
      console.log('Skipping seed as system templates already exist.');
      console.log('To force re-seed, manually delete existing system templates first.');
      await mongoose.connection.close();
      return;
    }

    // Insert templates
    const result = await InvoiceTemplate.insertMany(templates);
    console.log(`Successfully seeded ${result.length} invoice templates:`);
    result.forEach(template => {
      console.log(`  - ${template.name} (${template.type})`);
    });

    // Close connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    console.log('✅ Invoice templates seeded successfully!');
    
  } catch (error) {
    console.error('Error seeding invoice templates:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedInvoiceTemplates();
}

module.exports = { seedInvoiceTemplates, templates };

