import Swal from "sweetalert2";

const MySwal = Swal;

// 🔥 COMMON POPUP (Alert, Confirm, Success, Error)
export const showPopup = ({
  title = "Alert",
  text = "",
  icon = "info",
  confirmButtonText = "OK",
  showCancelButton = false,
  cancelButtonText = "Cancel",
}) => {
  return MySwal.fire({
    title,
    text,
    icon,
    confirmButtonText,
    showCancelButton,
    cancelButtonText,
    iconColor: "#6366F1", // Modern Indigo
    confirmButtonColor: "#4F46E5",
    cancelButtonColor: "#EF4444",
    background: "#ffffff",
  });
};

// 🔥 COMMON TOAST
export const showToast = (message, icon = "success") => {
  return Swal.fire({
    toast: true,
    icon,
    title: message,
    position: "top-end",
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,

    // Modern UI
    customClass: {
      popup: "rounded-xl shadow-lg backdrop-blur-md px-4 py-3",
    },
    didOpen: (toast) => {
      // Pause timer on hover
      toast.addEventListener("mouseenter", Swal.stopTimer);
      toast.addEventListener("mouseleave", Swal.resumeTimer);
    },

    background: "rgba(255, 255, 255, 0.9)",
    color: "#333",

    // Smooth show/hide animation
    showClass: {
      popup: "swal2-show",
    },
    hideClass: {
      popup: "swal2-hide",
    },
  });
};
