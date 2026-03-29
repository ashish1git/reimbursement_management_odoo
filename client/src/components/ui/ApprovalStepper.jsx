import { Check, Clock, X, Circle, Shield } from 'lucide-react';

const STEP_STATUS = {
  approved: { Icon: Check, bg: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-500' },
  rejected: { Icon: X, bg: 'bg-red-500', text: 'text-red-600', border: 'border-red-500' },
  pending: { Icon: Clock, bg: 'bg-amber-400', text: 'text-amber-600', border: 'border-amber-400' },
  upcoming: { Icon: Circle, bg: 'bg-slate-200', text: 'text-slate-400', border: 'border-slate-300' },
};

function StepIcon({ status }) {
  const { Icon, bg } = STEP_STATUS[status];
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${bg} shadow-sm flex-shrink-0`}>
      <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
    </div>
  );
}

export default function ApprovalStepper({ steps = [], currentStep = 0, logs = [], expenseStatus }) {
  if (!steps || steps.length === 0) {
    return <div className="text-slate-400 text-xs italic py-2">No approval steps configured.</div>;
  }

  const getStepStatus = (stepOrder) => {
    const log = logs?.find((l) => l.stepOrder === stepOrder);
    if (log) {
      return log.action === 'APPROVED' || log.action === 'ADMIN_OVERRIDE' ? 'approved' : 'rejected';
    }
    if (expenseStatus === 'APPROVED') return 'approved';
    if (expenseStatus === 'REJECTED') {
      if (stepOrder < currentStep) return 'approved';
      if (stepOrder === currentStep) return 'rejected';
    }
    if (stepOrder === currentStep) return 'pending';
    if (stepOrder < currentStep) return 'approved';
    return 'upcoming';
  };

  return (
    <div className="flex items-start overflow-x-auto pb-1 gap-0">
      {steps.map((step, idx) => {
        const status = getStepStatus(step.stepOrder ?? idx);
        const log = logs?.find((l) => l.stepOrder === (step.stepOrder ?? idx));
        const isLast = idx === steps.length - 1;
        const { text } = STEP_STATUS[status];

        return (
          <div key={step.stepOrder ?? idx} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center min-w-[80px] max-w-[100px]">
              <div className="relative">
                <StepIcon status={status} />
                {step.isRequired && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center"
                    title="Required approver — their rejection auto-rejects the expense">
                    <Shield className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
              <span className={`text-[11px] mt-1.5 font-semibold text-center leading-tight ${text}`}>
                {step.label || step.role || `Step ${(step.stepOrder ?? idx) + 1}`}
              </span>
              {step.isRequired && (
                <span className="text-[9px] text-indigo-500 font-bold mt-0.5">REQUIRED</span>
              )}
              {log?.comment && (
                <span className="text-[10px] text-slate-400 text-center mt-0.5 line-clamp-1" title={log.comment}>
                  "{log.comment}"
                </span>
              )}
              {log && (
                <span className={`text-[9px] mt-0.5 font-semibold ${
                  log.action === 'APPROVED' ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {log.action === 'APPROVED' ? '✓ Approved' : '✗ Rejected'}
                </span>
              )}
            </div>
            {!isLast && (
              <div
                className={`h-0.5 w-6 mx-0.5 flex-shrink-0 -translate-y-4 rounded-full transition-colors ${
                  getStepStatus((steps[idx + 1]?.stepOrder ?? idx + 1)) !== 'upcoming'
                    ? 'bg-emerald-400' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
