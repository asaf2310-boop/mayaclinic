import React from "react";
import { Button } from "@/components/ui/button";
import { clinicPrimaryBtn, clinicTextMuted, clinicTextPrimary } from "@/lib/clinicUi";

/**
 * Prevents a booking-form crash from blanking the whole page (white screen).
 */
export default class BookingErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[BookingErrorBoundary]", error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    if (typeof this.props.onReset === "function") {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-6 text-center space-y-3" dir="rtl">
          <p className={`text-base font-medium ${clinicTextPrimary}`}>
            משהו השתבש בטעינת בחירת התור
          </p>
          <p className={`text-sm ${clinicTextMuted}`}>
            אפשר לנסות שוב, או לבחור טיפול מחדש.
          </p>
          <Button type="button" onClick={this.handleRetry} className={clinicPrimaryBtn}>
            נסי שוב
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
