public class HandShakeThread extends Thread {
  boolean isRunning;
  byte[] hand = new byte[]{9, 9, 9};
  DatagramPacket handShakeCmnd = new DatagramPacket(hand, hand.length, telematicAddress, telematicPort_Cmnd);
  DatagramPacket handShakeData = new DatagramPacket(hand, hand.length, telematicAddress, telematicPort_Data);

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
          telematicServer_Data.send(handShakeData);
          telematicServer_Cmnd.send(handShakeCmnd);
        }
      } 
      catch(Exception e) {
        ;
      }
    }
  }
}
