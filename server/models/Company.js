import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    defaultCurrency: {
      type: String,
      required: [true, 'Default currency is required'],
      uppercase: true,
      trim: true,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,   // set after user creation
    },
  },
  { timestamps: true }
);

const Company = mongoose.model('Company', companySchema);

export default Company;
