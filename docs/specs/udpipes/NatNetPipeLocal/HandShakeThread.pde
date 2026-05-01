public class HandShakeThread extends Thread {
  boolean isRunning;
  byte[] hand = new byte[]{8, 8, 8};
  DatagramPacket handCmndShake = new DatagramPacket(hand, hand.length, telematicAddress, telematicPort_Cmnd);

  public void kill() {
    isRunning = false;
  }

  public void run() {
    System.out.println("HandShakeThread is running...");
    isRunning = true;
    while (isRunning) {
      try {
        while (true) {   
          sleep(checkIntervall / 2);
          // this package is sent to the server in order to setup the bidrectional connection
          telematicServer_Cmnd.send(handCmndShake);
        }
      } 
      catch(Exception e) {
        ;
      }
    }
  }
}
