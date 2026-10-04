import os
import sys

# Ensure captcha-lab is on sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LAB_DIR = os.path.join(BASE_DIR, "captcha-lab")
if LAB_DIR not in sys.path:
    sys.path.insert(0, LAB_DIR)

if __name__ == "__main__":
    from run_experiment import main
    main()
